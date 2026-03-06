// =============================================================================
// Task API SDK - Basic Usage Examples
// =============================================================================
//
// Run with: npx tsx examples/basic-usage.ts
//
// Make sure to set the OPPER_API_KEY environment variable before running:
//   export OPPER_API_KEY="your-api-key-here"
//

import { TaskApiClient, ApiError } from '../src/index.js';
import type {
  RunRequest,
  ChatRequest,
  EmbeddingsRequest,
  ParseRequest,
} from '../src/index.js';

// ---------------------------------------------------------------------------
// Initialise the client
// ---------------------------------------------------------------------------

const apiKey = process.env.OPPER_API_KEY;
if (!apiKey) {
  console.error('Error: OPPER_API_KEY environment variable is not set.');
  process.exit(1);
}

const client = new TaskApiClient({ apiKey });

// ---------------------------------------------------------------------------
// Helper: pretty-print JSON
// ---------------------------------------------------------------------------

function pp(label: string, data: unknown): void {
  console.log(`\n=== ${label} ===`);
  console.log(JSON.stringify(data, null, 2));
}

// ---------------------------------------------------------------------------
// 1. List available models
// ---------------------------------------------------------------------------

async function listModelsExample(): Promise<void> {
  try {
    const modelsResponse = await client.models.listModels();
    pp('Available Models', modelsResponse);
    console.log(
      `Found ${modelsResponse.models?.length ?? 0} model(s).`,
    );
  } catch (error) {
    if (error instanceof ApiError) {
      console.error(`API Error listing models: ${error.status} ${error.statusText}`);
      console.error('Body:', error.body);
    } else {
      throw error;
    }
  }
}

// ---------------------------------------------------------------------------
// 2. Run a function
// ---------------------------------------------------------------------------

async function runFunctionExample(): Promise<void> {
  try {
    // Define the function input – a simple text-to-summary function
    const runRequest: RunRequest = {
      input_schema: {
        type: 'object',
        properties: {
          text: { type: 'string', description: 'The text to summarise' },
        },
        required: ['text'],
      },
      output_schema: {
        type: 'object',
        properties: {
          summary: { type: 'string', description: 'A short summary of the text' },
        },
        required: ['summary'],
      },
      input: {
        text: 'TypeScript is a strongly typed programming language that builds on JavaScript, giving you better tooling at any scale.',
      },
      hints: {
        instructions: 'Summarise the given text in one sentence.',
      },
    };

    const result = await client.functions.runFunction('summarise', runRequest);
    pp('Run Function Result', result);
  } catch (error) {
    if (error instanceof ApiError) {
      console.error(`API Error running function: ${error.status} ${error.statusText}`);
      console.error('Body:', error.body);
    } else {
      throw error;
    }
  }
}

// ---------------------------------------------------------------------------
// 3. Chat completions
// ---------------------------------------------------------------------------

async function chatCompletionExample(): Promise<void> {
  try {
    const chatRequest: ChatRequest = {
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'What is the capital of France?' },
      ],
      model: 'openai/gpt-4o-mini',
      temperature: 0.7,
      max_tokens: 256,
    };

    const response = await client.chat.createCompletion(chatRequest);
    pp('Chat Completion', response);

    const assistantMessage = response.choices[0]?.message?.content;
    console.log('\nAssistant says:', assistantMessage);
  } catch (error) {
    if (error instanceof ApiError) {
      console.error(`API Error in chat completion: ${error.status} ${error.statusText}`);
      console.error('Body:', error.body);
    } else {
      throw error;
    }
  }
}

// ---------------------------------------------------------------------------
// 4. Streaming chat completions
// ---------------------------------------------------------------------------

async function streamingChatExample(): Promise<void> {
  try {
    const chatRequest: ChatRequest = {
      messages: [
        { role: 'user', content: 'Write a haiku about TypeScript.' },
      ],
      model: 'openai/gpt-4o-mini',
      temperature: 0.9,
    };

    console.log('\n=== Streaming Chat Completion ===');
    process.stdout.write('Assistant: ');

    for await (const chunk of client.chat.streamCompletion(chatRequest)) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        process.stdout.write(content);
      }
    }
    console.log(); // newline after stream finishes
  } catch (error) {
    if (error instanceof ApiError) {
      console.error(`\nAPI Error in streaming chat: ${error.status} ${error.statusText}`);
      console.error('Body:', error.body);
    } else {
      throw error;
    }
  }
}

// ---------------------------------------------------------------------------
// 5. Embeddings
// ---------------------------------------------------------------------------

async function embeddingsExample(): Promise<void> {
  try {
    const embeddingsRequest: EmbeddingsRequest = {
      input: 'The quick brown fox jumps over the lazy dog.',
      model: 'openai/text-embedding-3-small',
    };

    const response = await client.embeddings.createEmbeddings(embeddingsRequest);
    pp('Embeddings Response (truncated)', {
      model: response.model,
      object: response.object,
      usage: response.usage,
      first_embedding_length: response.data[0]?.embedding?.length,
      first_5_values: response.data[0]?.embedding?.slice(0, 5),
    });
  } catch (error) {
    if (error instanceof ApiError) {
      console.error(`API Error creating embeddings: ${error.status} ${error.statusText}`);
      console.error('Body:', error.body);
    } else {
      throw error;
    }
  }
}

// ---------------------------------------------------------------------------
// 6. List generations
// ---------------------------------------------------------------------------

async function listGenerationsExample(): Promise<void> {
  try {
    const response = await client.generations.listGenerations({
      page: 1,
      page_size: 5,
    });
    pp('Generations List', {
      total: response.meta.total,
      page: response.meta.page,
      page_size: response.meta.page_size,
      count: response.data.length,
    });
  } catch (error) {
    if (error instanceof ApiError) {
      console.error(`API Error listing generations: ${error.status} ${error.statusText}`);
      console.error('Body:', error.body);
    } else {
      throw error;
    }
  }
}

// ---------------------------------------------------------------------------
// 7. Parse a Starlark script
// ---------------------------------------------------------------------------

async function parseStarlarkExample(): Promise<void> {
  try {
    const parseRequest: ParseRequest = {
      source: `
def greet(name):
    return "Hello, " + name + "!"

result = greet("world")
`,
      filename: 'example.star',
    };

    const response = await client.parse.parseStarlark(parseRequest);
    pp('Parse Starlark Result', response);
  } catch (error) {
    if (error instanceof ApiError) {
      console.error(`API Error parsing Starlark: ${error.status} ${error.statusText}`);
      console.error('Body:', error.body);
    } else {
      throw error;
    }
  }
}

// ---------------------------------------------------------------------------
// 8. Health check
// ---------------------------------------------------------------------------

async function healthCheckExample(): Promise<void> {
  try {
    const response = await client.system.healthCheck();
    pp('Health Check', response);
  } catch (error) {
    if (error instanceof ApiError) {
      console.error(`API Error on health check: ${error.status} ${error.statusText}`);
      console.error('Body:', error.body);
    } else {
      throw error;
    }
  }
}

// ---------------------------------------------------------------------------
// Main: run all examples
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log('Task API SDK - Basic Usage Examples');
  console.log('====================================');

  // Health check first to verify connectivity
  await healthCheckExample();

  // List available models
  await listModelsExample();

  // Chat completions (standard and streaming)
  await chatCompletionExample();
  await streamingChatExample();

  // Run a function
  await runFunctionExample();

  // Embeddings
  await embeddingsExample();

  // List generations
  await listGenerationsExample();

  // Parse a Starlark script
  await parseStarlarkExample();

  console.log('\n====================================');
  console.log('All examples completed.');
}

main().catch((error: unknown) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});

