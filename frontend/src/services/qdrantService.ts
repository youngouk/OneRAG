import api from './api';
import {
  QdrantStatusResponse,
  QdrantMetricsResponse,
  QdrantCollectionsResponse,
  QdrantCollectionDetailResponse,
  QdrantResourceUsageResponse,
  QdrantHealthResponse,
} from '../types';

export const qdrantService = {
  getStatus: () => api.get<QdrantStatusResponse>('/api/v1/qdrant/status'),
  getMetrics: () => api.get<QdrantMetricsResponse>('/api/v1/qdrant/metrics'),
  getCollections: () => api.get<QdrantCollectionsResponse>('/api/v1/qdrant/collections'),
  getCollectionDetail: (collectionName: string) =>
    api.get<QdrantCollectionDetailResponse>(`/api/v1/qdrant/collections/${collectionName}`),
  getResourceUsage: () => api.get<QdrantResourceUsageResponse>('/api/v1/qdrant/resource-usage'),
  getHealth: () => api.get<QdrantHealthResponse>('/api/v1/qdrant/health'),
};

export default qdrantService;
