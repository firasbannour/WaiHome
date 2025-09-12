import { API, graphqlOperation } from 'aws-amplify';

// Requêtes GraphQL (à adapter selon ton schéma)
const queries = {
  listUsers: `
    query ListUsers {
      listUsers {
        items {
          id
          username
          email
        }
      }
    }
  `,
  
  listTodos: `
    query ListTodos {
      listTodos {
        items {
          id
          name
          description
          owner
        }
      }
    }
  `,
  
  todosByOwner: `
    query TodosByOwner($owner: ID!) {
      todosByOwner(owner: $owner) {
        items {
          id
          name
          description
          owner
        }
      }
    }
  `,
  
  usersByUsername: `
    query UsersByUsername($username: String!) {
      usersByUsername(username: $username) {
        items {
          id
          username
          email
        }
      }
    }
  `
};

// Mutations GraphQL
const mutations = {
  createUser: `
    mutation CreateUser($input: CreateUserInput!) {
      createUser(input: $input) {
        id
        username
        email
      }
    }
  `,
  
  createTodo: `
    mutation CreateTodo($input: CreateTodoInput!) {
      createTodo(input: $input) {
        id
        name
        description
        owner
      }
    }
  `,
  
  updateTodo: `
    mutation UpdateTodo($input: UpdateTodoInput!) {
      updateTodo(input: $input) {
        id
        name
        description
        owner
      }
    }
  `,
  
  deleteTodo: `
    mutation DeleteTodo($input: DeleteTodoInput!) {
      deleteTodo(input: $input) {
        id
        name
      }
    }
  `
};

export class GraphQLService {
  // Opérations sur les Users
  static async createUser(username, email) {
    try {
      const result = await API.graphql(
        graphqlOperation(mutations.createUser, {
          input: { username, email }
        })
      );
      return { success: true, data: result.data.createUser };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  static async listUsers() {
    try {
      const result = await API.graphql(
        graphqlOperation(queries.listUsers)
      );
      return { success: true, data: result.data.listUsers.items };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  static async getUserByUsername(username) {
    try {
      const result = await API.graphql(
        graphqlOperation(queries.usersByUsername, { username })
      );
      return { success: true, data: result.data.usersByUsername.items };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Opérations sur les Todos
  static async createTodo(name, description, owner) {
    try {
      const result = await API.graphql(
        graphqlOperation(mutations.createTodo, {
          input: { name, description, owner }
        })
      );
      return { success: true, data: result.data.createTodo };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  static async listTodos() {
    try {
      const result = await API.graphql(
        graphqlOperation(queries.listTodos)
      );
      return { success: true, data: result.data.listTodos.items };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  static async getTodosByOwner(owner) {
    try {
      const result = await API.graphql(
        graphqlOperation(queries.todosByOwner, { owner })
      );
      return { success: true, data: result.data.todosByOwner.items };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  static async updateTodo(id, name, description) {
    try {
      const result = await API.graphql(
        graphqlOperation(mutations.updateTodo, {
          input: { id, name, description }
        })
      );
      return { success: true, data: result.data.updateTodo };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  static async deleteTodo(id) {
    try {
      const result = await API.graphql(
        graphqlOperation(mutations.deleteTodo, {
          input: { id }
        })
      );
      return { success: true, data: result.data.deleteTodo };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
} 