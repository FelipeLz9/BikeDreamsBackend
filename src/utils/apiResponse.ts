export interface ApiResponse {
  success: boolean;
  message: string;
  data?: any;
  error?: string;
  timestamp?: string;
}

/**
 * Creates a standardized success response
 */
export function createSuccessResponse(data: any, message: string = 'Operation successful'): ApiResponse {
  return {
    success: true,
    message,
    data,
    timestamp: new Date().toISOString()
  };
}

/**
 * Creates a standardized error response
 */
export function createErrorResponse(message: string, error?: string): ApiResponse {
  return {
    success: false,
    message,
    error,
    timestamp: new Date().toISOString()
  };
}

/**
 * Creates a paginated response with metadata
 */
export function createPaginatedResponse(
  data: any[], 
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  },
  message: string = 'Data retrieved successfully'
): ApiResponse {
  return {
    success: true,
    message,
    data: {
      items: data,
      pagination: {
        ...pagination,
        hasNextPage: pagination.page < pagination.totalPages,
        hasPrevPage: pagination.page > 1
      }
    },
    timestamp: new Date().toISOString()
  };
}
