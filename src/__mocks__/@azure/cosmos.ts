import { Container } from "@azure/cosmos";

export const mockContainerCreate = jest.fn();
export const mockContainerQueryFetchAll = jest.fn();

export const containerMock = ({
  items: {
    create: mockContainerCreate,
    query: jest.fn(_ => ({
      fetchAll: mockContainerQueryFetchAll
    }))
  }
} as unknown) as Container;
