import { NextResponse } from 'next/server';
import { session } from '../../../lib/session.mjs';
import { github, graphql } from '../../../lib/github.mjs';
const valid = repo => /^[\w.-]+\/[\w.-]+$/.test(repo);
const pinnedQuery = 'query { viewer { pinnedItems(first: 100, types: [REPOSITORY]) { nodes { ... on Repository { id nameWithOwner } } } } }';
const repositoryIdQuery = 'query($owner:String!,$name:String!){ repository(owner:$owner,name:$name){ id } }';
const pinMutation = 'mutation($id:ID!){ pinRepository(input:{repositoryId:$id}) { repository { id } } }';
const unpinMutation = 'mutation($id:ID!){ unpinRepository(input:{repositoryId:$id}) { repository { id } } }';

export async function POST(request) {
  const s = await session();
  if (!s) return NextResponse.json({ error:'Sign in required.' }, { status:401 });
  if (request.headers.get('x-csrf-token') !== s.csrf) return NextResponse.json({ error:'Invalid request token.' }, { status:403 });
  try {
    const { action, repos = [], target, confirmation } = await request.json();
    if (['pin','unpin','unpinAll'].includes(action)) throw Error('GitHub does not expose repository pin or unpin operations through its supported API.');
    if (!['delete','transfer'].includes(action)) throw Error('Unknown action.');
    if (action === 'delete' && confirmation !== 'DELETE') throw Error('Type DELETE to confirm permanent deletion.');
    if (action === 'transfer' && !/^[\w.-]+$/.test(target || '')) throw Error('Enter the destination account or organization for transfer.');
    let list = repos.map(name => ({ name }));
    if (action === 'unpinAll') {
      const data = await graphql(pinnedQuery, {}, s.token);
      list = data.viewer.pinnedItems.nodes.map(repo => ({ name:repo.nameWithOwner, id:repo.id }));
    }
    if (!list.length || list.length > 100) throw Error(action === 'unpinAll' ? 'There are no pinned repositories to unpin.' : 'Choose between 1 and 100 repositories.');
    const results=[];
    for (const item of list) {
      const repo=item.name;
      if (!valid(repo)) { results.push({repo,ok:false,error:'Invalid repository.'}); continue; }
      try {
        if (action==='delete') await github(`/repos/${repo}`,s.token,{method:'DELETE'});
        else if (action==='transfer') await github(`/repos/${repo}/transfer`,s.token,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({new_owner:target})});
        else {
          const [owner,name]=repo.split('/');
          const id=item.id || (await graphql(repositoryIdQuery,{owner,name},s.token)).repository?.id;
          if (!id) throw Error('Repository was not found.');
          await graphql(action==='pin' ? pinMutation : unpinMutation, {id}, s.token);
        }
        results.push({repo,ok:true});
      } catch(e) { results.push({repo,ok:false,error:e.message}); }
    }
    return NextResponse.json({results});
  } catch(e) { return NextResponse.json({error:e.message},{status:400}); }
}
