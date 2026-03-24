// =============================================================================
// Task API SDK - Knowledge Base Client (proxied to v2 API)
// =============================================================================

import { BaseClient } from "../client-base.js";
import type {
  AddDocumentRequest,
  AddDocumentResponse,
  CreateKnowledgeBaseRequest,
  CreateKnowledgeBaseResponse,
  DeleteDocumentsRequest,
  DeleteDocumentsResponse,
  GetDocumentResponse,
  GetKnowledgeBaseResponse,
  GetUploadUrlResponse,
  KnowledgeBaseInfo,
  ListFilesResponse,
  PaginatedResponse,
  QueryKnowledgeBaseRequest,
  QueryKnowledgeBaseResponse,
  RegisterFileUploadRequest,
  RegisterFileUploadResponse,
  RequestOptions,
  UploadFileResponse,
} from "../types.js";

/** Base path for the v2 knowledge base API. */
const KB_PATH = "/v2/knowledge";

/**
 * KnowledgeClient provides access to the Opper Knowledge Base API (v2).
 *
 * Knowledge bases allow you to store, index, and query documents using
 * vector embeddings for semantic search.
 */
export class KnowledgeClient extends BaseClient {
  // ---------------------------------------------------------------------------
  // Knowledge Base CRUD
  // ---------------------------------------------------------------------------

  /**
   * Create a new knowledge base.
   *
   * @param body - Name and optional embedding model configuration.
   * @param options - Optional request options.
   * @returns The created knowledge base.
   */
  async create(
    body: CreateKnowledgeBaseRequest,
    options?: RequestOptions,
  ): Promise<CreateKnowledgeBaseResponse> {
    return this.post<CreateKnowledgeBaseResponse>(KB_PATH, body, options);
  }

  /**
   * List all knowledge bases with pagination.
   *
   * @param params - Optional offset and limit for pagination.
   * @param options - Optional request options.
   * @returns Paginated list of knowledge bases.
   */
  async list(
    params?: { offset?: number; limit?: number },
    options?: RequestOptions,
  ): Promise<PaginatedResponse<KnowledgeBaseInfo>> {
    return this.get<PaginatedResponse<KnowledgeBaseInfo>>(KB_PATH, params, options);
  }

  /**
   * Get a knowledge base by ID.
   *
   * @param id - The knowledge base UUID.
   * @param options - Optional request options.
   * @returns Knowledge base details including document count.
   */
  async getById(
    id: string,
    options?: RequestOptions,
  ): Promise<GetKnowledgeBaseResponse> {
    return this.get<GetKnowledgeBaseResponse>(`${KB_PATH}/${id}`, undefined, options);
  }

  /**
   * Get a knowledge base by name.
   *
   * @param name - The knowledge base name.
   * @param options - Optional request options.
   * @returns Knowledge base details including document count.
   */
  async getByName(
    name: string,
    options?: RequestOptions,
  ): Promise<GetKnowledgeBaseResponse> {
    return this.get<GetKnowledgeBaseResponse>(
      `${KB_PATH}/by-name/${encodeURIComponent(name)}`,
      undefined,
      options,
    );
  }

  /**
   * Delete a knowledge base and all its contents.
   *
   * @param id - The knowledge base UUID.
   * @param options - Optional request options.
   */
  async deleteKnowledgeBase(id: string, options?: RequestOptions): Promise<void> {
    return this.delete(`${KB_PATH}/${id}`, options);
  }

  // ---------------------------------------------------------------------------
  // Document Operations
  // ---------------------------------------------------------------------------

  /**
   * Add a text document to a knowledge base.
   *
   * The document will be chunked and embedded automatically.
   *
   * @param knowledgeBaseId - The knowledge base UUID.
   * @param body - Document content, optional key, metadata, and chunking configuration.
   * @param options - Optional request options.
   * @returns The added document metadata.
   */
  async add(
    knowledgeBaseId: string,
    body: AddDocumentRequest,
    options?: RequestOptions,
  ): Promise<AddDocumentResponse> {
    return this.post<AddDocumentResponse>(`${KB_PATH}/${knowledgeBaseId}/add`, body, options);
  }

  /**
   * Query a knowledge base using semantic search.
   *
   * @param knowledgeBaseId - The knowledge base UUID.
   * @param body - Query string, filters, and result configuration.
   * @param options - Optional request options.
   * @returns Array of matching documents with relevance scores.
   */
  async query(
    knowledgeBaseId: string,
    body: QueryKnowledgeBaseRequest,
    options?: RequestOptions,
  ): Promise<QueryKnowledgeBaseResponse[]> {
    return this.post<QueryKnowledgeBaseResponse[]>(
      `${KB_PATH}/${knowledgeBaseId}/query`,
      body,
      options,
    );
  }

  /**
   * Get a document by its key.
   *
   * @param knowledgeBaseId - The knowledge base UUID.
   * @param documentKey - The document key.
   * @param options - Optional request options.
   * @returns The document with its segments and metadata.
   */
  async getDocument(
    knowledgeBaseId: string,
    documentKey: string,
    options?: RequestOptions,
  ): Promise<GetDocumentResponse> {
    return this.get<GetDocumentResponse>(
      `${KB_PATH}/${knowledgeBaseId}/documents/${encodeURIComponent(documentKey)}`,
      undefined,
      options,
    );
  }

  /**
   * Delete documents from a knowledge base using optional filters.
   * If no filters are provided, all documents are deleted.
   *
   * @param knowledgeBaseId - The knowledge base UUID.
   * @param body - Optional filters to select documents for deletion.
   * @param options - Optional request options.
   * @returns The count of deleted documents.
   */
  async deleteDocuments(
    knowledgeBaseId: string,
    body?: DeleteDocumentsRequest,
    options?: RequestOptions,
  ): Promise<DeleteDocumentsResponse> {
    return this.request<DeleteDocumentsResponse>("DELETE", `${KB_PATH}/${knowledgeBaseId}/query`, {
      ...options,
      body,
    });
  }

  // ---------------------------------------------------------------------------
  // File Operations
  // ---------------------------------------------------------------------------

  /**
   * Upload a file directly to a knowledge base.
   *
   * The file will be processed, chunked, and indexed automatically.
   * Supports PDF, TXT, DOCX, MD, HTML, RTF, and more (max 50MB).
   *
   * @param knowledgeBaseId - The knowledge base UUID.
   * @param file - The file to upload (Blob, File, or Buffer).
   * @param params - Optional chunking configuration and metadata.
   * @param options - Optional request options.
   * @returns The uploaded file metadata.
   */
  async uploadFile(
    knowledgeBaseId: string,
    file: Blob,
    params?: {
      filename?: string;
      chunkSize?: number;
      chunkOverlap?: number;
      metadata?: Record<string, unknown>;
    },
    options?: RequestOptions,
  ): Promise<UploadFileResponse> {
    const formData = new FormData();
    formData.append("file", file, params?.filename);
    if (params?.chunkSize != null) {
      formData.append("text_processing.chunk_size", String(params.chunkSize));
    }
    if (params?.chunkOverlap != null) {
      formData.append("text_processing.chunk_overlap", String(params.chunkOverlap));
    }
    if (params?.metadata != null) {
      formData.append("metadata", JSON.stringify(params.metadata));
    }

    const url = `${this.baseUrl}${KB_PATH}/${knowledgeBaseId}/upload`;
    const headers = {
      Authorization: `Bearer ${this.apiKey}`,
      ...this.defaultHeaders,
      ...options?.headers,
    };
    // Remove Content-Type so fetch sets the multipart boundary automatically
    delete (headers as Record<string, string>)["Content-Type"];

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: formData,
      signal: options?.signal,
    });

    if (!response.ok) {
      let body: unknown;
      try {
        body = await response.json();
      } catch {
        body = await response.text().catch(() => undefined);
      }
      const { ApiError } = await import("../types.js");
      throw new ApiError(response.status, response.statusText, body);
    }

    return (await response.json()) as UploadFileResponse;
  }

  /**
   * Get a presigned URL for uploading a file to S3.
   *
   * This is step 1 of the 3-step upload process:
   * 1. Get upload URL → 2. Upload to S3 → 3. Register file
   *
   * @param knowledgeBaseId - The knowledge base UUID.
   * @param filename - The name of the file to upload.
   * @param options - Optional request options.
   * @returns Presigned URL, form fields, and file ID.
   */
  async getUploadUrl(
    knowledgeBaseId: string,
    filename: string,
    options?: RequestOptions,
  ): Promise<GetUploadUrlResponse> {
    return this.get<GetUploadUrlResponse>(
      `${KB_PATH}/${knowledgeBaseId}/upload_url`,
      { filename },
      options,
    );
  }

  /**
   * Register a file after uploading it to S3.
   *
   * This is step 3 of the 3-step upload process.
   *
   * @param knowledgeBaseId - The knowledge base UUID.
   * @param body - File registration details.
   * @param options - Optional request options.
   * @returns The registered file metadata.
   */
  async registerFileUpload(
    knowledgeBaseId: string,
    body: RegisterFileUploadRequest,
    options?: RequestOptions,
  ): Promise<RegisterFileUploadResponse> {
    return this.post<RegisterFileUploadResponse>(
      `${KB_PATH}/${knowledgeBaseId}/register_file`,
      body,
      options,
    );
  }

  /**
   * List files in a knowledge base with pagination.
   *
   * @param knowledgeBaseId - The knowledge base UUID.
   * @param params - Optional offset and limit for pagination.
   * @param options - Optional request options.
   * @returns Paginated list of files.
   */
  async listFiles(
    knowledgeBaseId: string,
    params?: { offset?: number; limit?: number },
    options?: RequestOptions,
  ): Promise<PaginatedResponse<ListFilesResponse>> {
    return this.get<PaginatedResponse<ListFilesResponse>>(
      `${KB_PATH}/${knowledgeBaseId}/files`,
      params,
      options,
    );
  }

  /**
   * Get a presigned download URL for a file.
   *
   * @param knowledgeBaseId - The knowledge base UUID.
   * @param fileId - The file UUID.
   * @param options - Optional request options.
   * @returns Object containing the download URL.
   */
  async getFileDownloadUrl(
    knowledgeBaseId: string,
    fileId: string,
    options?: RequestOptions,
  ): Promise<{ url: string }> {
    return this.get<{ url: string }>(
      `${KB_PATH}/${knowledgeBaseId}/files/${fileId}/download_url`,
      undefined,
      options,
    );
  }

  /**
   * Delete a file from a knowledge base.
   *
   * @param knowledgeBaseId - The knowledge base UUID.
   * @param fileId - The file UUID.
   * @param options - Optional request options.
   */
  async deleteFile(
    knowledgeBaseId: string,
    fileId: string,
    options?: RequestOptions,
  ): Promise<void> {
    return this.delete(`${KB_PATH}/${knowledgeBaseId}/files/${fileId}`, options);
  }
}
