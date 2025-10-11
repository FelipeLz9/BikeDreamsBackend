// Mock Prisma Client first
const mockPrismaForumPost = {
  create: jest.fn(),
  findMany: jest.fn(),
  findUnique: jest.fn()
};

jest.mock('../../prisma/client.js', () => ({
  prisma: {
    forumPost: mockPrismaForumPost
  }
}));

import { createForumPost, getForumPosts, getForumPostById } from '../../controllers/forumController';

describe('🗣️ ForumController Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createForumPost', () => {
    const validPostData = {
      userId: '550e8400-e29b-41d4-a716-446655440000',
      content: 'Este es un contenido válido para el post del foro'
    };

    it('should create forum post with valid data', async () => {
      const expectedPost = {
        id: 'post-123',
        ...validPostData,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      mockPrismaForumPost.create.mockResolvedValue(expectedPost);

      const result = await createForumPost({ body: validPostData });

      expect(mockPrismaForumPost.create).toHaveBeenCalledWith({
        data: validPostData
      });
      expect(result).toEqual(expectedPost);
    });

    it('should reject post with missing userId', async () => {
      const invalidData = {
        content: 'Contenido sin userId'
      };

      const result = await createForumPost({ body: invalidData });

      expect(result).toHaveProperty('error');
      expect(result.error).toBeDefined();
      expect(mockPrismaForumPost.create).not.toHaveBeenCalled();
    });

    it('should reject post with invalid userId format', async () => {
      const invalidData = {
        userId: 'invalid-uuid',
        content: 'Contenido válido'
      };

      const result = await createForumPost({ body: invalidData });

      expect(result).toHaveProperty('error');
      expect(result.error).toBeDefined();
      expect(mockPrismaForumPost.create).not.toHaveBeenCalled();
    });

    it('should reject post with empty content', async () => {
      const invalidData = {
        userId: validPostData.userId,
        content: ''
      };

      const result = await createForumPost({ body: invalidData });

      expect(result).toHaveProperty('error');
      expect(result.error).toBeDefined();
      expect(mockPrismaForumPost.create).not.toHaveBeenCalled();
    });

    it('should reject post with content too short', async () => {
      const invalidData = {
        userId: validPostData.userId,
        content: 'ABC'
      };

      const result = await createForumPost({ body: invalidData });

      expect(result).toHaveProperty('error');
      expect(result.error).toBeDefined();
      expect(mockPrismaForumPost.create).not.toHaveBeenCalled();
    });

    it('should accept post with minimum valid content length', async () => {
      const validMinData = {
        userId: validPostData.userId,
        content: 'ABCDE'
      };

      const expectedPost = {
        id: 'post-min',
        ...validMinData,
        createdAt: new Date()
      };

      mockPrismaForumPost.create.mockResolvedValue(expectedPost);

      const result = await createForumPost({ body: validMinData });

      expect(mockPrismaForumPost.create).toHaveBeenCalledWith({
        data: validMinData
      });
      expect(result).toEqual(expectedPost);
    });

    it('should handle database errors gracefully', async () => {
      mockPrismaForumPost.create.mockRejectedValue(new Error('Database error'));

      await expect(createForumPost({ body: validPostData }))
        .rejects.toThrow('Database error');

      expect(mockPrismaForumPost.create).toHaveBeenCalledWith({
        data: validPostData
      });
    });

    it('should handle malformed request body', async () => {
      const result = await createForumPost({ body: null });

      expect(result).toHaveProperty('error');
      expect(mockPrismaForumPost.create).not.toHaveBeenCalled();
    });

    it('should handle extra fields in request body', async () => {
      const dataWithExtraFields = {
        ...validPostData,
        extraField: 'should be ignored',
        anotherField: 123
      };

      const expectedPost = {
        id: 'post-extra',
        ...dataWithExtraFields,
        createdAt: new Date()
      };

      mockPrismaForumPost.create.mockResolvedValue(expectedPost);

      const result = await createForumPost({ body: dataWithExtraFields });

      expect(mockPrismaForumPost.create).toHaveBeenCalledWith({
        data: dataWithExtraFields
      });
      expect(result).toEqual(expectedPost);
    });
  });

  describe('getForumPosts', () => {
    it('should return all forum posts with user data', async () => {
      const expectedPosts = [
        {
          id: 'post-1',
          userId: '550e8400-e29b-41d4-a716-446655440001',
          content: 'Primer post del foro',
          createdAt: new Date(),
          user: {
            name: 'Juan Pérez',
            avatar: 'avatar1.jpg'
          }
        },
        {
          id: 'post-2', 
          userId: '550e8400-e29b-41d4-a716-446655440002',
          content: 'Segundo post del foro',
          createdAt: new Date(),
          user: {
            name: 'María García',
            avatar: 'avatar2.jpg'
          }
        }
      ];

      mockPrismaForumPost.findMany.mockResolvedValue(expectedPosts);

      const result = await getForumPosts();

      expect(mockPrismaForumPost.findMany).toHaveBeenCalledWith({
        include: { 
          user: { 
            select: { name: true, avatar: true } 
          } 
        }
      });
      expect(result).toEqual(expectedPosts);
    });

    it('should return empty array when no posts exist', async () => {
      mockPrismaForumPost.findMany.mockResolvedValue([]);

      const result = await getForumPosts();

      expect(result).toEqual([]);
      expect(mockPrismaForumPost.findMany).toHaveBeenCalledWith({
        include: { 
          user: { 
            select: { name: true, avatar: true } 
          } 
        }
      });
    });

    it('should handle database errors', async () => {
      mockPrismaForumPost.findMany.mockRejectedValue(new Error('Database connection failed'));

      await expect(getForumPosts())
        .rejects.toThrow('Database connection failed');

      expect(mockPrismaForumPost.findMany).toHaveBeenCalledWith({
        include: { 
          user: { 
            select: { name: true, avatar: true } 
          } 
        }
      });
    });

    it('should handle posts with null user data', async () => {
      const postsWithNullUser = [
        {
          id: 'post-orphan',
          userId: '550e8400-e29b-41d4-a716-446655440999',
          content: 'Post de usuario eliminado',
          createdAt: new Date(),
          user: null
        }
      ];

      mockPrismaForumPost.findMany.mockResolvedValue(postsWithNullUser);

      const result = await getForumPosts();

      expect(result).toEqual(postsWithNullUser);
      expect(mockPrismaForumPost.findMany).toHaveBeenCalled();
    });
  });

  describe('getForumPostById', () => {
    const validParams = { params: { id: 'post-123' } };

    it('should return forum post by valid ID', async () => {
      const expectedPost = {
        id: 'post-123',
        userId: '550e8400-e29b-41d4-a716-446655440001',
        content: 'Post específico del foro',
        createdAt: new Date(),
        user: {
          name: 'Juan Pérez',
          avatar: 'avatar1.jpg'
        }
      };

      mockPrismaForumPost.findUnique.mockResolvedValue(expectedPost);

      const result = await getForumPostById(validParams);

      expect(mockPrismaForumPost.findUnique).toHaveBeenCalledWith({
        where: { id: 'post-123' },
        include: { 
          user: { 
            select: { name: true, avatar: true } 
          } 
        }
      });
      expect(result).toEqual(expectedPost);
    });

    it('should return null for non-existent post ID', async () => {
      mockPrismaForumPost.findUnique.mockResolvedValue(null);

      const result = await getForumPostById({ params: { id: 'non-existent' } });

      expect(mockPrismaForumPost.findUnique).toHaveBeenCalledWith({
        where: { id: 'non-existent' },
        include: { 
          user: { 
            select: { name: true, avatar: true } 
          } 
        }
      });
      expect(result).toBeNull();
    });

    it('should handle database errors', async () => {
      mockPrismaForumPost.findUnique.mockRejectedValue(new Error('Database error'));

      await expect(getForumPostById(validParams))
        .rejects.toThrow('Database error');

      expect(mockPrismaForumPost.findUnique).toHaveBeenCalledWith({
        where: { id: 'post-123' },
        include: { 
          user: { 
            select: { name: true, avatar: true } 
          } 
        }
      });
    });

    it('should handle empty ID parameter', async () => {
      mockPrismaForumPost.findUnique.mockResolvedValue(null);
      
      const result = await getForumPostById({ params: { id: '' } });

      expect(mockPrismaForumPost.findUnique).toHaveBeenCalledWith({
        where: { id: '' },
        include: { 
          user: { 
            select: { name: true, avatar: true } 
          } 
        }
      });
      expect(result).toBeNull();
    });

    it('should return post with null user when user is deleted', async () => {
      const postWithDeletedUser = {
        id: 'post-123',
        userId: '550e8400-e29b-41d4-a716-446655440999',
        content: 'Post de usuario eliminado',
        createdAt: new Date(),
        user: null
      };

      mockPrismaForumPost.findUnique.mockResolvedValue(postWithDeletedUser);

      const result = await getForumPostById(validParams);

      expect(result).toEqual(postWithDeletedUser);
      expect(mockPrismaForumPost.findUnique).toHaveBeenCalled();
    });

    it('should handle very long post content', async () => {
      const longContentPost = {
        id: 'post-long',
        userId: '550e8400-e29b-41d4-a716-446655440001',
        content: 'Lorem ipsum '.repeat(1000), // Very long content
        createdAt: new Date(),
        user: {
          name: 'Usuario Verboso',
          avatar: 'verbose.jpg'
        }
      };

      mockPrismaForumPost.findUnique.mockResolvedValue(longContentPost);

      const result = await getForumPostById({ params: { id: 'post-long' } });

      expect(result).toEqual(longContentPost);
      expect(mockPrismaForumPost.findUnique).toHaveBeenCalled();
    });

    it('should handle special characters in post ID', async () => {
      const specialIdParams = { params: { id: 'post-123-@#$%^&*()' } };
      
      mockPrismaForumPost.findUnique.mockResolvedValue(null);

      const result = await getForumPostById(specialIdParams);

      expect(mockPrismaForumPost.findUnique).toHaveBeenCalledWith({
        where: { id: 'post-123-@#$%^&*()' },
        include: { 
          user: { 
            select: { name: true, avatar: true } 
          } 
        }
      });
      expect(result).toBeNull();
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle undefined body in createForumPost', async () => {
      const result = await createForumPost({ body: undefined });

      expect(result).toHaveProperty('error');
      expect(mockPrismaForumPost.create).not.toHaveBeenCalled();
    });

    it('should handle missing params object in getForumPostById', async () => {
      await expect(getForumPostById({} as any))
        .rejects.toThrow();
    });

    it('should handle database timeout in all functions', async () => {
      const timeoutError = new Error('Connection timeout');
      
      mockPrismaForumPost.create.mockRejectedValue(timeoutError);
      mockPrismaForumPost.findMany.mockRejectedValue(timeoutError);
      mockPrismaForumPost.findUnique.mockRejectedValue(timeoutError);

      await expect(createForumPost({ 
        body: { 
          userId: '550e8400-e29b-41d4-a716-446655440000', 
          content: 'Test content' 
        } 
      })).rejects.toThrow('Connection timeout');

      await expect(getForumPosts()).rejects.toThrow('Connection timeout');

      await expect(getForumPostById({ 
        params: { id: 'test-id' } 
      })).rejects.toThrow('Connection timeout');
    });
  });
});
