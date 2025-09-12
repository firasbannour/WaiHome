import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { AuthService } from '../services/authService';
import { GraphQLService } from '../services/graphqlService';

export default function TodoScreen() {
  const [todos, setTodos] = useState([]);
  const [newTodoName, setNewTodoName] = useState('');
  const [newTodoDescription, setNewTodoDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState('');

  useEffect(() => {
    loadCurrentUser();
    loadTodos();
  }, []);

  const loadCurrentUser = async () => {
    const result = await AuthService.getCurrentUserId();
    if (result.success) {
      setCurrentUserId(result.data);
    }
  };

  const loadTodos = async () => {
    setLoading(true);
    try {
      const result = await GraphQLService.getTodosByOwner(currentUserId);
      if (result.success) {
        setTodos(result.data);
      } else {
        Alert.alert('Erreur', result.error);
      }
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de charger les todos');
    } finally {
      setLoading(false);
    }
  };

  const createTodo = async () => {
    if (!newTodoName.trim()) {
      Alert.alert('Erreur', 'Veuillez entrer un nom pour la tâche');
      return;
    }

    setLoading(true);
    try {
      const result = await GraphQLService.createTodo(
        newTodoName,
        newTodoDescription,
        currentUserId
      );
      if (result.success) {
        setNewTodoName('');
        setNewTodoDescription('');
        loadTodos(); // Recharger la liste
        Alert.alert('Succès', 'Tâche créée avec succès !');
      } else {
        Alert.alert('Erreur', result.error);
      }
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de créer la tâche');
    } finally {
      setLoading(false);
    }
  };

  const deleteTodo = async (todoId) => {
    Alert.alert(
      'Confirmation',
      'Êtes-vous sûr de vouloir supprimer cette tâche ?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
                      text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              const result = await GraphQLService.deleteTodo(todoId);
              if (result.success) {
                loadTodos(); // Recharger la liste
                Alert.alert('Success', 'Task deleted!');
              } else {
                Alert.alert('Error', result.error);
              }
            } catch (error) {
              Alert.alert('Error', 'Unable to delete task');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const renderTodo = ({ item }) => (
    <View style={styles.todoItem}>
      <View style={styles.todoContent}>
        <Text style={styles.todoName}>{item.name}</Text>
        <Text style={styles.todoDescription}>{item.description}</Text>
      </View>
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => deleteTodo(item.id)}
      >
        <Text style={styles.deleteButtonText}>Delete</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>My Tasks</Text>
      
      {/* Formulaire pour créer une nouvelle tâche */}
      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder="Task name"
          value={newTodoName}
          onChangeText={setNewTodoName}
        />
        <TextInput
          style={styles.input}
          placeholder="Description (optional)"
          value={newTodoDescription}
          onChangeText={setNewTodoDescription}
          multiline
        />
        <TouchableOpacity
          style={styles.addButton}
          onPress={createTodo}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.addButtonText}>Add a task</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Liste des tâches */}
      <View style={styles.listContainer}>
        <Text style={styles.listTitle}>Tasks ({todos.length})</Text>
        {loading ? (
          <ActivityIndicator size="large" color="#007AFF" />
        ) : (
          <FlatList
            data={todos}
            renderItem={renderTodo}
            keyExtractor={(item) => item.id}
            style={styles.list}
            ListEmptyComponent={
              <Text style={styles.emptyText}>No tasks at the moment</Text>
            }
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#333',
  },
  form: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    padding: 10,
    marginBottom: 10,
    fontSize: 16,
  },
  addButton: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 5,
    alignItems: 'center',
  },
  addButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  listContainer: {
    flex: 1,
  },
  listTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  list: {
    flex: 1,
  },
  todoItem: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.22,
    shadowRadius: 2.22,
    elevation: 3,
  },
  todoContent: {
    flex: 1,
  },
  todoName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  todoDescription: {
    fontSize: 14,
    color: '#666',
  },
  deleteButton: {
    backgroundColor: '#FF3B30',
    padding: 8,
    borderRadius: 5,
    marginLeft: 10,
  },
  deleteButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  emptyText: {
    textAlign: 'center',
    color: '#666',
    fontSize: 16,
    marginTop: 50,
  },
}); 