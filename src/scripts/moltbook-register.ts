#!/usr/bin/env node
import { parseArgs } from 'node:util';
import crypto from 'node:crypto';

const MOLTBOOK_API = 'https://www.moltbook.com/api/v1';

interface RegistrationResponse {
  agent: {
    api_key: string;
    claim_url: string;
    verification_code: string;
  };
  important: string;
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      name: { type: 'string', short: 'n' },
      description: { type: 'string', short: 'd' },
      help: { type: 'boolean', short: 'h' },
    },
  });

  if (values.help) {
    console.log(`
Usage: pnpm moltbook:register --name <agent-name> [--description <desc>]

Register a new Moltbook agent and get environment variables for poke-tools.

Options:
  -n, --name         Agent name on Moltbook (required)
  -d, --description  Agent description (optional, defaults to "{name} on Poke")
  -h, --help         Show this help message

Example:
  pnpm moltbook:register --name "PokeAgent" --description "Poke's social presence"
`);
    process.exit(0);
  }

  if (!values.name) {
    console.error('Error: --name is required');
    console.error('Usage: pnpm moltbook:register --name <agent-name> [--description <desc>]');
    console.error('Run with --help for more information.');
    process.exit(1);
  }

  console.log(`\nRegistering Moltbook agent: ${values.name}...`);

  try {
    const response = await fetch(`${MOLTBOOK_API}/agents/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: values.name,
        description: values.description || `${values.name}`,
      }),
    });

    if (!response.ok) {
      const error = (await response.json().catch(() => ({}))) as {
        error?: string;
        hint?: string;
      };
      console.error('\nRegistration failed!');
      console.error(`Error: ${error.error || response.statusText}`);
      if (error.hint) {
        console.error(`Hint: ${error.hint}`);
      }
      process.exit(1);
    }

    const data = (await response.json()) as RegistrationResponse;
    const endpoint = crypto.randomBytes(16).toString('hex');

    console.log('\n' + '='.repeat(60));
    console.log('  Agent registered successfully!');
    console.log('='.repeat(60));

    console.log('\nAdd these to your .env file:\n');
    console.log('# Moltbook Integration');
    console.log('MOLTBOOK_ENABLED=true');
    console.log(`MOLTBOOK_1_NAME=${values.name}`);
    console.log(`MOLTBOOK_1_ENDPOINT=${endpoint}`);
    console.log(`MOLTBOOK_1_API_KEY=${data.agent.api_key}`);
    console.log('MOLTBOOK_1_POLLING_ENABLED=true');
    console.log('MOLTBOOK_1_POLLING_INTERVAL=300000');
    console.log('MOLTBOOK_1_FEED_SORT=new');

    console.log('\n' + '-'.repeat(60));
    console.log('\nIMPORTANT: Save your API key! You cannot retrieve it later.');
    console.log('\n' + '-'.repeat(60));

    console.log('\nClaim URL (send to your human to verify ownership):');
    console.log(`  ${data.agent.claim_url}`);

    console.log(`\nVerification code: ${data.agent.verification_code}`);

    console.log('\n' + '='.repeat(60));
    console.log('  Next steps:');
    console.log('  1. Add the environment variables to your .env file');
    console.log('  2. Send the claim URL to your human');
    console.log('  3. They will verify via Twitter/X post');
    console.log('  4. Restart poke-tools to connect to Moltbook');
    console.log('='.repeat(60) + '\n');
  } catch (error) {
    console.error('\nFailed to connect to Moltbook API');
    console.error(error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
