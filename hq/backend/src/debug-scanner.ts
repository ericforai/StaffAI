import { Scanner } from './scanner';
import path from 'path';

async function test() {
  const scanner = new Scanner();
  const agents = await scanner.scan();
  console.log(`Total agents scanned: ${agents.length}`);
  const dispatcher = agents.find(a => a.id === 'dispatcher');
  if (dispatcher) {
    console.log('SUCCESS: Dispatcher found!');
    console.log(JSON.stringify(dispatcher.profile, null, 2));
  } else {
    console.log('FAILURE: Dispatcher NOT found.');
    console.log('Available IDs:', agents.map(a => a.id).join(', '));
  }
}

test();
