// =============================================================================
// Task API SDK - Basic Usage Examples
// =============================================================================
//
// Run this example with:
//   npx tsx examples/basic-usage.ts
//
// Make sure to set the OPPER_API_KEY environment variable before running.
// =============================================================================

import {
  TaskApiClient,
  type ChatRequest,
  type RunRequest,
  type EmbeddingsRequest,
  type ParseRequest,
} from '../src/index.js';

// ---------------------------------------------------------------------------
// Initialize the client with your API key
// ---------------------------------------------------------------------------

const apiKey = process.env.OPPER_API_KEY;
if (!apiKey) {
  console.error('Error: Please set the OPPER_API_KEY environment variable.');
  process.exit(1);
}

const client = new TaskApiClient({ apiKey });

// ---------------------------------------------------------------------------
// Helper to print section headers
// ---------------------------------------------------------------------------

function section(title: string): void {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  ${title}`);
  console.log(`${'='.repeat(60)}\n`);
}

// ---------------------------------------------------------------------------
// 1. Health Check
// ---------------------------------------------------------------------------

async function healthCheckExample(): Promise<void> {
  section('1. Health Check');

  const health = await client.system.healthCheck();
  console.log('Server health:', health);
}

// ---------------------------------------------------------------------------
// 2. List Models
// ---------------------------------------------------------------------------

async function listModelsExample(): Promise<void> {
  section('2. List Models');

  const modelsResponse = await client.models.listModels();
  const models = modelsResponse.data ?? [];
  console.log(`Found ${models.length} model(s):`);
  for (const model of models.slice(0, 5)) {
    console.log(`  - ${model.id}: ${model.name ?? 'unnamed'}`);
  }
  if (models.length > 5) {
    console.log(`  ... and ${models.length - 5} more`);
  }
}

// ---------------------------------------------------------------------------
// 3. Run a Function
// ---------------------------------------------------------------------------

async function runFunctionExample(): Promise<void> {
  section('3. Run a Function');

  const runRequest: RunRequest = {
    input: 'Translate the following to French: Hello, how are you?',
    input_schema: '{ "type": "string" }',
    output_schema: '{ "type": "string" }',
  };

  try {
    const result = await client.functions.runFunction('translate', runRequest);
    console.log('Function output:', result.output);
    if (result.usage) {
      console.log('Token usage:', result.usage);
    }
  } catch (error) {
    console.log('Function run example (expected error if function does not exist):', error);
  }
}

// ---------------------------------------------------------------------------
// 4. Stream a Function
// ---------------------------------------------------------------------------

async function streamFunctionExample(): Promise<void> {
  section('4. Stream a Function');

  const runRequest: RunRequest = {
    input: 'Write a short haiku about TypeScript.',
    input_schema: '{ "type": "string" }',
    output_schema: '{ "type": "string" }',
  };

  try {
    process.stdout.write('Streaming output: ');
    for await (const chunk of client.functions.streamFunction('haiku-writer', runRequest)) {
      if (chunk.output) {
        process.stdout.write(chunk.output);
      }
    }
    console.log('\n(stream complete)');
  } catch (error) {
    console.log('Stream example (expected error if function does not exist):', error);
  }
}

// ---------------------------------------------------------------------------
// 5. Chat Completions
// ---------------------------------------------------------------------------

async function chatCompletionExample(): Promise<void> {
  section('5. Chat Completions');

  const chatRequest: ChatRequest = {
    model: 'openai/gpt-4o',
    messages: [
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: 'What is the capital of France?' },
    ],
  };

  try {
    // Non-streaming chat completion
    const response = await client.chat.createCompletion(chatRequest);
    console.log('Chat response:', response.choices?.[0]?.message?.content);
    console.log('Usage:', response.usage);
  } catch (error) {
    console.log('Chat completion example error:', error);
  }
}

// ---------------------------------------------------------------------------
// 6. Streaming Chat Completions
// ---------------------------------------------------------------------------

async function streamingChatExample(): Promise<void> {
  section('6. Streaming Chat Completions');

  const chatRequest: ChatRequest = {
    model: 'openai/gpt-4o',
    messages: [
      { role: 'user', content: 'Count from 1 to 5, one number per line.' },
    ],
  };

  try {
    process.stdout.write('Streaming chat: ');
    for await (const chunk of client.chat.streamCompletion(chatRequest)) {
      const delta = chunk.choices?.[0]?.delta?.content;
      if (delta) {
        process.stdout.write(delta);
      }
    }
    console.log('\n(stream complete)');
  } catch (error) {
    console.log('Streaming chat example error:', error);
  }
}

// ---------------------------------------------------------------------------
// 7. Embeddings
// ---------------------------------------------------------------------------

async function embeddingsExample(): Promise<void> {
  section('7. Embeddings');

  const embeddingsRequest: EmbeddingsRequest = {
    model: 'openai/text-embedding-3-small',
    input: 'The quick brown fox jumps over the lazy dog.',
  };

  try {
    const response = await client.embeddings.create(embeddingsRequest);
    const firstItem = response.data?.[0];
    if (firstItem?.embedding) {
      console.log(`Embedding dimensions: ${firstItem.embedding.length}`);
      console.log(`First 5 values: [${firstItem.embedding.slice(0, 5).join(', ')}]`);
    }
    console.log('Usage:', response.usage);
  } catch (error) {
    console.log('Embeddings example error:', error);
  }
}

// ---------------------------------------------------------------------------
// 8. List Generations
// ---------------------------------------------------------------------------

async function listGenerationsExample(): Promise<void> {
  section('8. List Generations');

  try {
    const response = await client.generations.listGenerations(1, 5);
    console.log(`Generations (page ${response.meta.page} of ${response.meta.total_pages}):`);
    console.log(`Total items: ${response.meta.total}`);
    for (const gen of response.data.slice(0, 3)) {
      console.log(`  - Generation:`, JSON.stringify(gen).slice(0, 100) + '...');
    }
  } catch (error) {
    console.log('List generations example error:', error);
  }
}

// ---------------------------------------------------------------------------
// 9. Parse Starlark
// ---------------------------------------------------------------------------

async function parseStarlarkExample(): Promise<void> {
  section('9. Parse Starlark');

  const parseRequest: ParseRequest = {
    source: `
def greet(name):
    return "Hello, " + name + "!"

result = greet("World")
`,
  };

  try {
    const parsed = await client.parse.parseStarlark(parseRequest);
    console.log('Parse result:', JSON.stringify(parsed, null, 2));
  } catch (error) {
    console.log('Parse Starlark example error:', error);
  }
}

// ---------------------------------------------------------------------------
// Run all examples
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log('Task API SDK - Basic Usage Examples');
  console.log('====================================');

  await healthCheckExample();
  await listModelsExample();
  await runFunctionExample();
  await streamFunctionExample();
  await chatCompletionExample();
  await streamingChatExample();
  await embeddingsExample();
  await listGenerationsExample();
  await parseStarlarkExample();

  section('Done!');
  console.log('All examples completed successfully.');
}

main().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});

