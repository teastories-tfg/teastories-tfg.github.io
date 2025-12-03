import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Edit2, Trash2, Calendar, User, CheckCircle2, Clock, AlertCircle, Pause, X, Sun, Moon, Lock, Unlock, Users, Key, ArrowUp, ArrowDown, Send } from 'lucide-react';

// ============ CONSTANTS I CONFIGURACIÓ ============

const ASSET_TYPES = ['Props', 'Personatges', 'Environments', 'Shots'];
const ROLES = ['Modeling', 'UVs', 'Surfacing', 'Rigging', 'Animation', 'Lighting', 'Compositing'];
const STAGES = ROLES; // Les etapes són els rols
const STATUSES = {
  todo: { label: 'To Do', color: 'bg-gray-200 text-gray-700', darkColor: 'bg-gray-700 text-gray-300', icon: Clock },
  wip: { label: 'WIP', color: 'bg-blue-500 text-white', darkColor: 'bg-blue-600 text-white', icon: AlertCircle },
  review: { label: 'Review', color: 'bg-yellow-500 text-white', darkColor: 'bg-yellow-600 text-white', icon: AlertCircle },
  needs_fix: { label: 'Needs Fix', color: 'bg-red-500 text-white', darkColor: 'bg-red-600 text-white', icon: AlertCircle },
  done: { label: 'Done', color: 'bg-green-500 text-white', darkColor: 'bg-green-600 text-white', icon: CheckCircle2 },
  cancelled: { label: 'Cancelled', color: 'bg-red-500 text-white', darkColor: 'bg-red-600 text-white', icon: X }
};

// Contrasenya per l'admin (pots canviar-la)
const ADMIN_PASSWORD = 'Udolf67';

const calculateDaysRemaining = (deadline) => {
  if (!deadline) return null;
  const today = new Date();
  const deadlineDate = new Date(deadline);
  const diff = Math.ceil((deadlineDate - today) / (1000 * 60 * 60 * 24));
  return diff;
};

// ============ HOOK PER SINCRONITZACIÓ ENTRE PESTANYES ============

const useLocalStorageSync = (key, initialValue) => {
  const [value, setValue] = useState(() => {
    const stored = localStorage.getItem(key);
    try {
      return stored ? JSON.parse(stored) : initialValue;
    } catch (e) {
      console.error(`Error parsing ${key}:`, e);
      return initialValue;
    }
  });

  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === key && e.newValue !== null) {
        try {
          const newValue = JSON.parse(e.newValue);
          if (JSON.stringify(value) !== JSON.stringify(newValue)) {
            setValue(newValue);
          }
        } catch (err) {
          console.error(`Error parsing ${key} from storage:`, err);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [key, value]);

  const setStoredValue = (newValue) => {
    const valueToStore = newValue instanceof Function ? newValue(value) : newValue;
    setValue(valueToStore);
    localStorage.setItem(key, JSON.stringify(valueToStore));
    
    // Forçar actualització en altres pestanyes
    localStorage.setItem('pipeline-sync-timestamp', Date.now().toString());
  };

  return [value, setStoredValue];
};

// ============ COMPONENTS ============

// Component per mostrar comentaris
function CommentsPanel({ assetId, comments, currentUser, onAddComment, darkMode }) {
  const [newComment, setNewComment] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (newComment.trim()) {
      onAddComment(assetId, newComment);
      setNewComment('');
    }
  };

  return (
    <div className={`mt-4 p-4 rounded-lg ${darkMode ? 'bg-gray-800' : 'bg-gray-50'}`}>
      <h4 className={`font-semibold mb-3 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Comentaris</h4>
      
      <div className="space-y-3 mb-4 max-h-60 overflow-y-auto">
        {comments.map((comment, index) => (
          <div key={index} className={`p-3 rounded shadow-sm ${darkMode ? 'bg-gray-700' : 'bg-white'}`}>
            <div className="flex justify-between items-start mb-2">
              <span className={`font-semibold text-sm ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>{comment.user}</span>
              <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                {new Date(comment.timestamp).toLocaleString('ca-ES')}
              </span>
            </div>
            <p className={darkMode ? 'text-gray-300' : 'text-gray-700'}>{comment.text}</p>
          </div>
        ))}
        {comments.length === 0 && (
          <p className={`text-center py-4 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>No hi ha comentaris</p>
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Afegeix un comentari..."
          className={`flex-1 px-3 py-2 border rounded-lg ${darkMode ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-white'}`}
        />
        <button
          type="submit"
          className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 flex items-center gap-2"
        >
          <Send size={16} />
          Enviar
        </button>
      </form>
    </div>
  );
}

// Component per mostrar/afegir problemes
function IssuesPanel({ assetId, issues, currentUser, onAddIssue, onResolveIssue, darkMode }) {
  const [newIssue, setNewIssue] = useState('');
  const [issueStage, setIssueStage] = useState('');
  const [showIssueForm, setShowIssueForm] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (newIssue.trim() && issueStage) {
      onAddIssue(assetId, newIssue, issueStage);
      setNewIssue('');
      setIssueStage('');
      setShowIssueForm(false);
    }
  };

  const activeIssues = issues.filter(issue => !issue.resolved);
  const resolvedIssues = issues.filter(issue => issue.resolved);

  return (
    <div className={`mt-4 p-4 border rounded-lg ${darkMode ? 'bg-red-900/30 border-red-800' : 'bg-red-50 border-red-200'}`}>
      <div className="flex justify-between items-center mb-3">
        <h4 className={`font-semibold ${darkMode ? 'text-red-300' : 'text-red-700'}`}>Problemes</h4>
        <button
          onClick={() => setShowIssueForm(!showIssueForm)}
          className="bg-red-500 text-white px-3 py-1 rounded text-sm hover:bg-red-600"
        >
          + Reportar Problema
        </button>
      </div>

      {showIssueForm && (
        <form onSubmit={handleSubmit} className={`mb-4 p-3 rounded shadow ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
          <div className="mb-2">
            <label className={`block text-sm font-semibold mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Etapa afectada</label>
            <select
              value={issueStage}
              onChange={(e) => setIssueStage(e.target.value)}
              className={`w-full px-3 py-2 border rounded ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : ''}`}
              required
            >
              <option value="">Selecciona etapa</option>
              {STAGES.map(stage => (
                <option key={stage} value={stage}>{stage}</option>
              ))}
            </select>
          </div>
          <div className="mb-2">
            <label className={`block text-sm font-semibold mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Descripció del problema</label>
            <textarea
              value={newIssue}
              onChange={(e) => setNewIssue(e.target.value)}
              placeholder="Descriu el problema que s'ha de corregir..."
              className={`w-full px-3 py-2 border rounded ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : ''}`}
              rows="3"
              required
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
            >
              Reportar
            </button>
            <button
              type="button"
              onClick={() => setShowIssueForm(false)}
              className={`px-4 py-2 rounded hover:opacity-90 ${darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-300 text-gray-700'}`}
            >
              Cancel·lar
            </button>
          </div>
        </form>
      )}

      <div className="space-y-2 mb-4">
        <h5 className={`text-sm font-semibold ${darkMode ? 'text-red-300' : 'text-red-600'}`}>Problemes Actius ({activeIssues.length})</h5>
        {activeIssues.map((issue, index) => (
          <div key={index} className={`p-3 rounded border ${darkMode ? 'bg-gray-800 border-red-800' : 'bg-white border-red-300'}`}>
            <div className="flex justify-between items-start mb-2">
              <div>
                <span className={`font-semibold ${darkMode ? 'text-red-300' : 'text-red-700'}`}>{issue.stage}</span>
                <span className={`text-xs ml-2 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  per {issue.reportedBy} • {new Date(issue.timestamp).toLocaleDateString('ca-ES')}
                </span>
              </div>
              <button
                onClick={() => onResolveIssue(assetId, index)}
                className="bg-green-500 text-white px-2 py-1 rounded text-xs hover:bg-green-600"
              >
                Resolt
              </button>
            </div>
            <p className={darkMode ? 'text-gray-300' : 'text-gray-700'}>{issue.description}</p>
          </div>
        ))}
        {activeIssues.length === 0 && (
          <p className={`text-center py-2 ${darkMode ? 'text-green-400' : 'text-green-600'}`}>No hi ha problemes actius ✓</p>
        )}
      </div>

      {resolvedIssues.length > 0 && (
        <div className="space-y-2">
          <h5 className={`text-sm font-semibold ${darkMode ? 'text-green-300' : 'text-green-600'}`}>Problemes Resolts ({resolvedIssues.length})</h5>
          {resolvedIssues.map((issue, index) => (
            <div key={index} className={`p-3 rounded border ${darkMode ? 'bg-green-900/30 border-green-800' : 'bg-green-50 border-green-300'}`}>
              <div className="flex justify-between items-start mb-2">
                <span className={`font-semibold ${darkMode ? 'text-green-300' : 'text-green-700'}`}>{issue.stage}</span>
                <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  Resolt {new Date(issue.resolvedAt).toLocaleDateString('ca-ES')}
                </span>
              </div>
              <p className={`${darkMode ? 'text-gray-400' : 'text-gray-700'} line-through`}>{issue.description}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Component per gestió d'usuaris (només admin)
function UserManagement({ users, setUsers, darkMode }) {
  const [newUser, setNewUser] = useState('');
  const [editingIndex, setEditingIndex] = useState(null);
  const [editName, setEditName] = useState('');

  const handleAddUser = () => {
    if (newUser.trim() && !users.includes(newUser.trim())) {
      setUsers([...users, newUser.trim()]);
      setNewUser('');
    }
  };

  const handleDeleteUser = (index) => {
    if (window.confirm(`Segur que vols eliminar l'usuari "${users[index]}"?`)) {
      const newUsers = users.filter((_, i) => i !== index);
      setUsers(newUsers);
    }
  };

  const handleEditUser = (index) => {
    setEditingIndex(index);
    setEditName(users[index]);
  };

  const handleSaveEdit = () => {
    if (editName.trim() && editingIndex !== null) {
      const newUsers = [...users];
      newUsers[editingIndex] = editName.trim();
      setUsers(newUsers);
      setEditingIndex(null);
      setEditName('');
    }
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
    setEditName('');
  };

  return (
    <div className={`p-4 rounded-lg mb-4 ${darkMode ? 'bg-gray-800' : 'bg-gray-100'}`}>
      <h3 className={`font-bold text-lg mb-3 flex items-center gap-2 ${darkMode ? 'text-white' : 'text-gray-800'}`}>
        <Users size={20} />
        Gestió d'Usuaris
      </h3>
      
      <div className="mb-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={newUser}
            onChange={(e) => setNewUser(e.target.value)}
            placeholder="Nom del nou usuari..."
            className={`flex-1 px-3 py-2 border rounded ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : ''}`}
            onKeyPress={(e) => e.key === 'Enter' && handleAddUser()}
          />
          <button
            onClick={handleAddUser}
            className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
          >
            Afegir
          </button>
        </div>
        <p className={`text-xs mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
          Nota: "Admin" és l'usuari principal i no es pot eliminar
        </p>
      </div>

      <div className="space-y-2">
        <h4 className={`font-semibold text-sm ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
          Usuaris existents ({users.length})
        </h4>
        {users.map((user, index) => (
          <div key={index} className={`flex items-center justify-between p-2 rounded ${
            darkMode ? 'bg-gray-700' : 'bg-white'
          }`}>
            {editingIndex === index ? (
              <div className="flex items-center gap-2 flex-1">
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className={`flex-1 px-2 py-1 border rounded ${darkMode ? 'bg-gray-600 border-gray-500 text-white' : ''}`}
                  autoFocus
                />
                <button
                  onClick={handleSaveEdit}
                  className="bg-blue-500 text-white px-2 py-1 rounded text-xs hover:bg-blue-600"
                >
                  Guardar
                </button>
                <button
                  onClick={handleCancelEdit}
                  className="bg-gray-500 text-white px-2 py-1 rounded text-xs hover:bg-gray-600"
                >
                  Cancel·lar
                </button>
              </div>
            ) : (
              <>
                <span className={darkMode ? 'text-gray-300' : 'text-gray-700'}>
                  {user} {user === 'Admin' && <span className="text-xs text-purple-500">(Admin)</span>}
                </span>
                <div className="flex gap-1">
                  {user !== 'Admin' && (
                    <>
                      <button
                        onClick={() => handleEditUser(index)}
                        className={`p-1 rounded ${darkMode ? 'hover:bg-gray-600' : 'hover:bg-gray-200'}`}
                        title="Editar"
                      >
                        <Edit2 size={14} className={darkMode ? 'text-gray-400' : 'text-gray-600'} />
                      </button>
                      <button
                        onClick={() => handleDeleteUser(index)}
                        className={`p-1 rounded ${darkMode ? 'hover:bg-gray-600' : 'hover:bg-gray-200'}`}
                        title="Eliminar"
                      >
                        <Trash2 size={14} className="text-red-500" />
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// Component per gestió de rols (només admin)
function RoleManagement({ roles, setRoles, darkMode }) {
  const [newRole, setNewRole] = useState('');
  const [editingIndex, setEditingIndex] = useState(null);
  const [editRole, setEditRole] = useState('');

  const handleAddRole = () => {
    if (newRole.trim() && !roles.includes(newRole.trim())) {
      setRoles([...roles, newRole.trim()]);
      setNewRole('');
    }
  };

  const handleDeleteRole = (index) => {
    if (window.confirm(`Segur que vols eliminar el rol "${roles[index]}"?`)) {
      const newRoles = roles.filter((_, i) => i !== index);
      setRoles(newRoles);
    }
  };

  const handleEditRole = (index) => {
    setEditingIndex(index);
    setEditRole(roles[index]);
  };

  const handleSaveEdit = () => {
    if (editRole.trim() && editingIndex !== null) {
      const newRoles = [...roles];
      newRoles[editingIndex] = editRole.trim();
      setRoles(newRoles);
      setEditingIndex(null);
      setEditRole('');
    }
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
    setEditRole('');
  };

  return (
    <div className={`p-4 rounded-lg ${darkMode ? 'bg-gray-800' : 'bg-gray-100'}`}>
      <h3 className={`font-bold text-lg mb-3 flex items-center gap-2 ${darkMode ? 'text-white' : 'text-gray-800'}`}>
        <Key size={20} />
        Gestió de Rols/Etapes
      </h3>
      
      <div className="mb-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={newRole}
            onChange={(e) => setNewRole(e.target.value)}
            placeholder="Nom del nou rol..."
            className={`flex-1 px-3 py-2 border rounded ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : ''}`}
            onKeyPress={(e) => e.key === 'Enter' && handleAddRole()}
          />
          <button
            onClick={handleAddRole}
            className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
          >
            Afegir
          </button>
        </div>
        <p className={`text-xs mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
          Els rols també són les etapes disponibles per als assets
        </p>
      </div>

      <div className="space-y-2">
        <h4 className={`font-semibold text-sm ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
          Rols existents ({roles.length})
        </h4>
        {roles.map((role, index) => (
          <div key={index} className={`flex items-center justify-between p-2 rounded ${
            darkMode ? 'bg-gray-700' : 'bg-white'
          }`}>
            {editingIndex === index ? (
              <div className="flex items-center gap-2 flex-1">
                <input
                  type="text"
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value)}
                  className={`flex-1 px-2 py-1 border rounded ${darkMode ? 'bg-gray-600 border-gray-500 text-white' : ''}`}
                  autoFocus
                />
                <button
                  onClick={handleSaveEdit}
                  className="bg-blue-500 text-white px-2 py-1 rounded text-xs hover:bg-blue-600"
                >
                  Guardar
                </button>
                <button
                  onClick={handleCancelEdit}
                  className="bg-gray-500 text-white px-2 py-1 rounded text-xs hover:bg-gray-600"
                >
                  Cancel·lar
                </button>
              </div>
            ) : (
              <>
                <span className={darkMode ? 'text-gray-300' : 'text-gray-700'}>{role}</span>
                <div className="flex gap-1">
                  <button
                    onClick={() => handleEditRole(index)}
                    className={`p-1 rounded ${darkMode ? 'hover:bg-gray-600' : 'hover:bg-gray-200'}`}
                    title="Editar"
                  >
                    <Edit2 size={14} className={darkMode ? 'text-gray-400' : 'text-gray-600'} />
                  </button>
                  <button
                    onClick={() => handleDeleteRole(index)}
                    className={`p-1 rounded ${darkMode ? 'hover:bg-gray-600' : 'hover:bg-gray-200'}`}
                    title="Eliminar"
                  >
                    <Trash2 size={14} className="text-red-500" />
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// Component per reordenar categories i personatges
function ReorderCategories({ assetTypes, setAssetTypes, assets, setAssets, darkMode }) {
  const [localTypes, setLocalTypes] = useState([...assetTypes]);

  const moveUp = (index) => {
    if (index === 0) return;
    const newTypes = [...localTypes];
    [newTypes[index], newTypes[index - 1]] = [newTypes[index - 1], newTypes[index]];
    setLocalTypes(newTypes);
  };

  const moveDown = (index) => {
    if (index === localTypes.length - 1) return;
    const newTypes = [...localTypes];
    [newTypes[index], newTypes[index + 1]] = [newTypes[index + 1], newTypes[index]];
    setLocalTypes(newTypes);
  };

  const saveOrder = () => {
    setAssetTypes(localTypes);
    
    // També reordenem els assets perquè es mostrin en aquest ordre
    const orderedAssets = [...assets].sort((a, b) => {
      const indexA = localTypes.indexOf(a.type);
      const indexB = localTypes.indexOf(b.type);
      return indexA - indexB;
    });
    
    setAssets(orderedAssets);
  };

  const resetOrder = () => {
    setLocalTypes([...assetTypes]);
  };

  return (
    <div className={`p-4 rounded-lg mb-4 ${darkMode ? 'bg-gray-800' : 'bg-gray-100'}`}>
      <h3 className={`font-bold text-lg mb-3 flex items-center gap-2 ${darkMode ? 'text-white' : 'text-gray-800'}`}>
        📊 Reordenar Categories
      </h3>
      
      <div className="mb-4">
        <p className={`text-sm mb-3 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
          Arrossega i deixa anar o fes servir les fletxes per reordenar les categories. Aquest ordre també s'aplicarà als assets.
        </p>
        
        <div className="space-y-2 mb-4">
          {localTypes.map((type, index) => (
            <div key={type} className={`flex items-center justify-between p-3 rounded ${
              darkMode ? 'bg-gray-700' : 'bg-white border'
            }`}>
              <div className="flex items-center gap-3">
                <span className={`font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  {type}
                </span>
                <span className={`text-xs px-2 py-1 rounded ${darkMode ? 'bg-gray-600 text-gray-300' : 'bg-gray-200 text-gray-600'}`}>
                  {assets.filter(a => a.type === type).length} assets
                </span>
              </div>
              
              <div className="flex gap-1">
                <button
                  onClick={() => moveUp(index)}
                  disabled={index === 0}
                  className={`p-2 rounded ${index === 0 ? 'opacity-30 cursor-not-allowed' : 'hover:bg-gray-600'}`}
                  title="Moure amunt"
                >
                  <ArrowUp size={16} className={darkMode ? 'text-gray-400' : 'text-gray-600'} />
                </button>
                <button
                  onClick={() => moveDown(index)}
                  disabled={index === localTypes.length - 1}
                  className={`p-2 rounded ${index === localTypes.length - 1 ? 'opacity-30 cursor-not-allowed' : 'hover:bg-gray-600'}`}
                  title="Moure avall"
                >
                  <ArrowDown size={16} className={darkMode ? 'text-gray-400' : 'text-gray-600'} />
                </button>
              </div>
            </div>
          ))}
        </div>
        
        <div className="flex gap-2 mt-4">
          <button
            onClick={saveOrder}
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
          >
            Guardar Ordre
          </button>
          <button
            onClick={resetOrder}
            className={`px-4 py-2 rounded ${darkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-300 text-gray-700 hover:bg-gray-400'}`}
          >
            Restaurar
          </button>
        </div>
      </div>
    </div>
  );
}

// Component per login d'admin
function AdminLogin({ onLogin, darkMode }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (password === ADMIN_PASSWORD) {
      onLogin();
    } else {
      setError('Contrasenya incorrecta');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className={`rounded-lg max-w-md w-full p-6 ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
        <div className="flex items-center justify-center mb-6">
          <Lock size={32} className="text-purple-500 mr-3" />
          <h2 className="text-2xl font-bold">Accés Admin</h2>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={`block text-sm font-semibold mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              Contrasenya d'administrador
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError('');
              }}
              className={`w-full px-4 py-2 border rounded-lg ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : ''} ${error ? 'border-red-500' : ''}`}
              placeholder="Introdueix la contrasenya..."
              autoFocus
            />
            {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              className="flex-1 bg-purple-600 text-white py-2 rounded-lg hover:bg-purple-700 font-semibold"
            >
              <div className="flex items-center justify-center gap-2">
                <Unlock size={18} />
                Accedir
              </div>
            </button>
          </div>
        </form> 
      </div>
    </div>
  );
}

// Component per notificar sincronització
function SyncNotification({ darkMode, onDismiss }) {
  const [show, setShow] = useState(true);

  const handleDismiss = () => {
    setShow(false);
    onDismiss?.();
  };

  if (!show) return null;

  return (
    <div className={`fixed top-4 right-4 z-50 animate-pulse ${darkMode ? 'bg-green-800 text-green-100' : 'bg-green-100 text-green-800'} px-4 py-3 rounded-lg shadow-lg flex items-center gap-3`}>
      <div className="w-3 h-3 bg-green-500 rounded-full animate-ping"></div>
      <span>✓ Dades actualitzades</span>
      <button onClick={handleDismiss} className="ml-2 text-lg font-bold">&times;</button>
    </div>
  );
}

// Modal per configuració d'admin
function AdminConfigModal({ users, setUsers, roles, setRoles, assets, setAssets, darkMode, onClose }) {
  const [assetTypes, setAssetTypes] = useState(['Props', 'Personatges', 'Environments', 'Shots']);
  const [activeTab, setActiveTab] = useState('reorder');

  useEffect(() => {
    const savedTypes = localStorage.getItem('pipeline-asset-types');
    if (savedTypes) {
      try {
        setAssetTypes(JSON.parse(savedTypes));
      } catch (e) {
        console.log('Error parsing asset types:', e);
      }
    }
  }, []);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className={`rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-800'}`}>
              Configuració d'Administrador
            </h2>
            <button
              onClick={onClose}
              className={`p-2 rounded-full ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-200'}`}
            >
              <X size={24} className={darkMode ? 'text-gray-400' : 'text-gray-600'} />
            </button>
          </div>

          <div className="mb-6">
            <div className="flex border-b">
              <button
                onClick={() => setActiveTab('reorder')}
                className={`px-4 py-2 font-medium ${
                  activeTab === 'reorder'
                    ? `${darkMode ? 'text-blue-400 border-b-2 border-blue-400' : 'text-blue-600 border-b-2 border-blue-600'}`
                    : `${darkMode ? 'text-gray-400 hover:text-gray-300' : 'text-gray-600 hover:text-gray-800'}`
                }`}
              >
                📊 Reordenar Categories
              </button>
              <button
                onClick={() => setActiveTab('users')}
                className={`px-4 py-2 font-medium ${
                  activeTab === 'users'
                    ? `${darkMode ? 'text-blue-400 border-b-2 border-blue-400' : 'text-blue-600 border-b-2 border-blue-600'}`
                    : `${darkMode ? 'text-gray-400 hover:text-gray-300' : 'text-gray-600 hover:text-gray-800'}`
                }`}
              >
                👥 Usuaris
              </button>
              <button
                onClick={() => setActiveTab('roles')}
                className={`px-4 py-2 font-medium ${
                  activeTab === 'roles'
                    ? `${darkMode ? 'text-blue-400 border-b-2 border-blue-400' : 'text-blue-600 border-b-2 border-blue-600'}`
                    : `${darkMode ? 'text-gray-400 hover:text-gray-300' : 'text-gray-600 hover:text-gray-800'}`
                }`}
              >
                🔑 Rols/Etapes
              </button>
            </div>
          </div>

          {activeTab === 'reorder' && (
            <ReorderCategories
              assetTypes={assetTypes}
              setAssetTypes={setAssetTypes}
              assets={assets}
              setAssets={setAssets}
              darkMode={darkMode}
            />
          )}

          {activeTab === 'users' && (
            <UserManagement users={users} setUsers={setUsers} darkMode={darkMode} />
          )}

          {activeTab === 'roles' && (
            <RoleManagement roles={roles} setRoles={setRoles} darkMode={darkMode} />
          )}

          <div className="mt-6 pt-6 border-t border-gray-700">
            <div className={`p-4 rounded-lg ${darkMode ? 'bg-gray-900' : 'bg-blue-50'}`}>
              <h4 className={`font-semibold mb-2 ${darkMode ? 'text-blue-300' : 'text-blue-700'}`}>
                ℹ️ Informació important
              </h4>
              <ul className={`text-sm space-y-1 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                <li>• Els canvis en usuaris i rols s'apliquen immediatament</li>
                <li>• Si elimines un rol, els assets existents poden perdre informació</li>
                <li>• El rol "Admin" no es pot eliminar ni modificar</li>
                <li>• Els rols defineixen les etapes disponibles pels assets</li>
                <li>• El reordenament de categories afecta com es mostren els assets</li>
              </ul>
            </div>
          </div>

          <div className="flex justify-end mt-6">
            <button
              onClick={onClose}
              className={`px-6 py-2 rounded-lg font-semibold ${
                darkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Tancar Configuració
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Component per notes d'asset
function AssetNotesSection({ assetId, assetType, notes, currentUser, onAddNote, darkMode }) {
  const [newNote, setNewNote] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (newNote.trim()) {
      onAddNote(assetId, newNote);
      setNewNote('');
    }
  };

  const filteredNotes = notes.filter(note => note.type === assetType);

  return (
    <div className={`p-3 border-t ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
      <h4 className={`font-semibold mb-2 text-sm flex items-center gap-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
        📝 Notes per {assetType}
      </h4>
      
      <div className="space-y-2 mb-3 max-h-40 overflow-y-auto">
        {filteredNotes.map((note, index) => (
          <div key={index} className={`p-2 rounded text-sm ${darkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
            <div className="flex justify-between items-start mb-1">
              <span className={`font-semibold ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>{note.user}</span>
              <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                {new Date(note.timestamp).toLocaleString('ca-ES')}
              </span>
            </div>
            <p className={darkMode ? 'text-gray-300' : 'text-gray-700'}>{note.text}</p>
          </div>
        ))}
        {filteredNotes.length === 0 && (
          <p className={`text-center py-2 text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
            No hi ha notes per aquest {assetType.toLowerCase()}
          </p>
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          placeholder={`Escriu una nota per aquest ${assetType.toLowerCase()}...`}
          className={`flex-1 px-3 py-2 border rounded text-sm ${darkMode ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-white'}`}
        />
        <button
          type="submit"
          className="bg-blue-500 text-white px-3 py-2 rounded hover:bg-blue-600 flex items-center gap-1"
          title="Enviar nota"
        >
          <Send size={14} />
        </button>
      </form>
    </div>
  );
}

// ============ COMPONENT PRINCIPAL ============

export default function PipelineTracker() {
  // Estats sincronitzats entre pestanyes
  const [assets, setAssets] = useLocalStorageSync('pipeline-assets', []);
  const [users, setUsers] = useLocalStorageSync('pipeline-users', ['Admin', 'Artista 1', 'Artista 2', 'Artista 3']);
  const [roles, setRoles] = useLocalStorageSync('pipeline-roles', ['Modeling', 'UVs', 'Surfacing', 'Rigging', 'Animation', 'Lighting', 'Compositing']);
  const [assetTypes, setAssetTypes] = useLocalStorageSync('pipeline-asset-types', ['Props', 'Personatges', 'Environments', 'Shots']);
  const [assetNotes, setAssetNotes] = useLocalStorageSync('pipeline-asset-notes', {});
  
  // Estats locals (no es sincronitzen)
  const [currentUser, setCurrentUser] = useState('Admin');
  const [showModal, setShowModal] = useState(false);
  const [showAdminConfig, setShowAdminConfig] = useState(false);
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [editingAsset, setEditingAsset] = useState(null);
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterUser, setFilterUser] = useState('all');
  const [darkMode, setDarkMode] = useState(false);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [showSyncNotification, setShowSyncNotification] = useState(false);

  // Carregar preferències (no sincronitzades)
  useEffect(() => {
    const savedDarkMode = localStorage.getItem('pipeline-darkmode');
    const savedAdminAuth = localStorage.getItem('pipeline-admin-auth');
    
    if (savedDarkMode) {
      setDarkMode(JSON.parse(savedDarkMode));
    }
    
    if (savedAdminAuth) {
      setIsAdminAuthenticated(JSON.parse(savedAdminAuth));
    }
  }, []);

  // Guardar preferències (no sincronitzades)
  useEffect(() => {
    localStorage.setItem('pipeline-darkmode', JSON.stringify(darkMode));
  }, [darkMode]);

  useEffect(() => {
    localStorage.setItem('pipeline-admin-auth', JSON.stringify(isAdminAuthenticated));
  }, [isAdminAuthenticated]);

  // Escoltar canvis sincronitzats i mostrar notificació
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'pipeline-sync-timestamp') {
        setShowSyncNotification(true);
        setTimeout(() => setShowSyncNotification(false), 3000);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  // Convertir assets antics automàticament
  useEffect(() => {
    const needsConversion = assets.some(asset => !asset.stageDetails && asset.stageProgress);
    
    if (needsConversion) {
      const convertedAssets = assets.map(asset => {
        if (asset.stageDetails) return asset;
        
        if (asset.stageProgress) {
          const stageDetails = {};
          asset.stages?.forEach(stage => {
            stageDetails[stage] = {
              status: asset.stageProgress[stage] || 'todo',
              assignedTo: asset.assignedTo,
              reviewer: asset.reviewer || '',
              deadline: asset.deadline || null,
              startDate: null,
              endDate: null
            };
          });
          
          return {
            ...asset,
            stageDetails
          };
        }
        
        return asset;
      });
      
      setAssets(convertedAssets);
    }
  }, [assets, setAssets]);

  // Funció per assegurar stageDetails
  const ensureStageDetails = (asset) => {
    if (asset.stageDetails && Object.keys(asset.stageDetails).length > 0) {
      return asset;
    }
    
    const stageDetails = {};
    asset.stages?.forEach(stage => {
      stageDetails[stage] = {
        status: 'todo',
        assignedTo: asset.assignedTo,
        reviewer: asset.reviewer || '',
        deadline: asset.deadline || null,
        startDate: null,
        endDate: null
      };
    });
    
    return { ...asset, stageDetails };
  };

  const createAsset = (assetData) => {
    const newAsset = {
      id: Date.now(),
      ...assetData,
      createdBy: currentUser,
      createdAt: new Date().toISOString(),
      stageDetails: assetData.stages.reduce((acc, stage) => ({ 
        ...acc, 
        [stage]: {
          status: 'todo',
          assignedTo: assetData.assignedTo,
          reviewer: assetData.reviewer || '',
          deadline: assetData.deadline || null,
          startDate: null,
          endDate: null
        }
      }), {}),
      comments: [],
      issues: []
    };
    
    const updatedAssets = [...assets, newAsset];
    setAssets(updatedAssets);
    setShowSyncNotification(true);
    setTimeout(() => setShowSyncNotification(false), 3000);
  };

  const updateAsset = (id, updates) => {
    const newAssets = assets.map(asset => {
      if (asset.id === id) {
        const updatedAsset = { ...asset, ...updates };
        
        // Actualitzar stageDetails si cal
        if (updates.assignedTo || updates.reviewer || updates.deadline) {
          const currentDetails = ensureStageDetails(updatedAsset).stageDetails;
          const newStageDetails = {};
          
          Object.keys(currentDetails).forEach(stage => {
            newStageDetails[stage] = {
              ...currentDetails[stage],
              assignedTo: updates.assignedTo || currentDetails[stage].assignedTo,
              reviewer: updates.reviewer !== undefined ? updates.reviewer : currentDetails[stage].reviewer,
              deadline: updates.deadline !== undefined ? updates.deadline : currentDetails[stage].deadline
            };
          });
          
          updatedAsset.stageDetails = newStageDetails;
        }
        
        return updatedAsset;
      }
      return asset;
    });
    
    setAssets(newAssets);
    setShowSyncNotification(true);
    setTimeout(() => setShowSyncNotification(false), 3000);
  };

  const deleteAsset = (id) => {
    const newAssets = assets.filter(asset => asset.id !== id);
    setAssets(newAssets);
    setShowSyncNotification(true);
    setTimeout(() => setShowSyncNotification(false), 3000);
  };

  const updateStageDetails = (assetId, stage, updates) => {
    const newAssets = assets.map(asset => {
      if (asset.id === assetId) {
        const safeAsset = ensureStageDetails(asset);
        const currentDetails = safeAsset.stageDetails;
        
        const newStageDetails = {
          ...currentDetails,
          [stage]: {
            ...currentDetails[stage],
            ...updates
          }
        };
        
        // Comprovar si totes les etapes estan fetes
        const allDone = asset.stages?.every(s => 
          newStageDetails[s]?.status === 'done'
        ) || false;
        
        return {
          ...asset,
          stageDetails: newStageDetails,
          status: allDone ? 'done' : asset.status
        };
      }
      return asset;
    });
    
    setAssets(newAssets);
    setShowSyncNotification(true);
    setTimeout(() => setShowSyncNotification(false), 2000);
  };

  const addComment = (assetId, commentText) => {
    const newAssets = assets.map(asset => {
      if (asset.id === assetId) {
        return {
          ...asset,
          comments: [
            ...(asset.comments || []),
            {
              text: commentText,
              user: currentUser,
              timestamp: new Date().toISOString()
            }
          ]
        };
      }
      return asset;
    });
    
    setAssets(newAssets);
    setShowSyncNotification(true);
    setTimeout(() => setShowSyncNotification(false), 2000);
  };

  const addIssue = (assetId, issueDescription, stage) => {
    const newAssets = assets.map(asset => {
      if (asset.id === assetId) {
        const newIssue = {
          description: issueDescription,
          stage: stage,
          reportedBy: currentUser,
          timestamp: new Date().toISOString(),
          resolved: false
        };
        
        return {
          ...asset,
          issues: [...(asset.issues || []), newIssue]
        };
      }
      return asset;
    });
    
    setAssets(newAssets);
    setShowSyncNotification(true);
    setTimeout(() => setShowSyncNotification(false), 2000);
  };

  const resolveIssue = (assetId, issueIndex) => {
    const newAssets = assets.map(asset => {
      if (asset.id === assetId) {
        const updatedIssues = [...(asset.issues || [])];
        if (updatedIssues[issueIndex]) {
          updatedIssues[issueIndex] = {
            ...updatedIssues[issueIndex],
            resolved: true,
            resolvedAt: new Date().toISOString()
          };
        }
        
        return {
          ...asset,
          issues: updatedIssues
        };
      }
      return asset;
    });
    
    setAssets(newAssets);
    setShowSyncNotification(true);
    setTimeout(() => setShowSyncNotification(false), 2000);
  };

  const addNoteToAsset = (assetId, noteText) => {
    if (!noteText.trim()) return;
    
    const asset = assets.find(a => a.id === assetId);
    if (!asset) return;
    
    const newNote = {
      text: noteText,
      user: currentUser,
      timestamp: new Date().toISOString(),
      type: asset.type
    };
    
    const newAssetNotes = {
      ...assetNotes,
      [assetId]: [
        ...(assetNotes[assetId] || []),
        newNote
      ]
    };
    
    setAssetNotes(newAssetNotes);
    setShowSyncNotification(true);
    setTimeout(() => setShowSyncNotification(false), 2000);
  };

  const filteredAssets = useMemo(() => {
    const ensuredAssets = assets.map(asset => ensureStageDetails(asset));
    
    // Ordenar per l'ordre de les categories
    const sortedAssets = [...ensuredAssets].sort((a, b) => {
      const indexA = assetTypes.indexOf(a.type);
      const indexB = assetTypes.indexOf(b.type);
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    });
    
    return sortedAssets.filter(asset => {
      if (filterType !== 'all' && asset.type !== filterType) return false;
      if (filterStatus !== 'all' && asset.status !== filterStatus) return false;
      if (filterUser !== 'all' && asset.assignedTo !== filterUser) return false;
      
      // Si és Admin, veu tot
      if (currentUser === 'Admin' && isAdminAuthenticated) return true;
      
      // Si no és admin o no està autenticat, aplicar filtres normals
      const stageDetails = asset.stageDetails;
      
      // Comprovar si l'usuari està assignat a alguna etapa (com a artista)
      const isAssignedToAnyStage = asset.stages?.some(stage => {
        const stageDetail = stageDetails[stage];
        return stageDetail && stageDetail.assignedTo === currentUser;
      }) || false;
      
      // Comprovar si l'usuari és reviewer d'alguna etapa
      const isReviewerOfAnyStage = asset.stages?.some(stage => {
        const stageDetail = stageDetails[stage];
        return stageDetail && stageDetail.reviewer === currentUser;
      }) || false;
      
      // Si està assignat com a artista, ho veu sempre
      if (isAssignedToAnyStage) {
        // PERÒ: Si totes les etapes estan "done", no ho veu (desapareix)
        const allStagesDone = asset.stages?.every(stage => {
          const stageDetail = stageDetails[stage];
          return stageDetail?.status === 'done';
        }) || false;
        
        // Només veu si alguna etapa NO està done
        return !allStagesDone;
      }
      
      // Si és reviewer, només veu si té etapes per revisar
      if (isReviewerOfAnyStage) {
        const hasStagesToReview = asset.stages?.some(stage => {
          const stageDetail = stageDetails[stage];
          if (!stageDetail) return false;
          const stageStatus = stageDetail.status || 'todo';
          const isUserReviewerOfThisStage = stageDetail.reviewer === currentUser;
          return isUserReviewerOfThisStage && ['review', 'needs_fix'].includes(stageStatus);
        });
        return hasStagesToReview;
      }
      
      // Si no està involucrat de cap manera, no ho veu
      return false;
    });
  }, [assets, filterType, filterStatus, filterUser, currentUser, isAdminAuthenticated, assetTypes]);

  const handleAdminLogin = () => {
    setIsAdminAuthenticated(true);
    setShowAdminLogin(false);
  };

  const handleLogoutAdmin = () => {
    setIsAdminAuthenticated(false);
    if (currentUser === 'Admin') {
      setCurrentUser(users.filter(u => u !== 'Admin')[0] || users[0]);
    }
  };

  return (
    <div className={`h-screen flex flex-col ${darkMode ? 'bg-gray-900 text-white' : 'bg-gradient-to-br from-purple-50 to-blue-50'}`}>
      {/* Notificació de sincronització */}
      {showSyncNotification && (
        <SyncNotification 
          darkMode={darkMode} 
          onDismiss={() => setShowSyncNotification(false)} 
        />
      )}
      
      {/* HEADER */}
      <div className={`shadow-md flex-shrink-0 px-2 py-2 md:px-4 md:py-3 ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-2">
          <div className="flex items-center gap-3">
            <h1 className="text-lg md:text-xl font-bold truncate">Pipeline Tracker</h1>
            <button
              onClick={() => setDarkMode(!darkMode)}
              className={`p-2 rounded-full ${darkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-200 hover:bg-gray-300'}`}
              title={darkMode ? 'Mode clar' : 'Mode fosc'}
            >
              {darkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
          
          <div className="flex flex-row gap-2 w-full sm:w-auto">
            <select 
              value={currentUser}
              onChange={(e) => {
                setCurrentUser(e.target.value);
                if (e.target.value === 'Admin' && !isAdminAuthenticated) {
                  setShowAdminLogin(true);
                }
              }}
              className={`px-2 py-1 border rounded text-sm flex-1 sm:flex-none sm:min-w-[120px] ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : ''}`}
            >
              {users.map(user => (
                <option key={user} value={user}>
                  {user} {user === 'Admin' && !isAdminAuthenticated ? ' (🔒)' : ''}
                </option>
              ))}
            </select>
            
            {currentUser === 'Admin' && isAdminAuthenticated ? (
              <div className="flex gap-1">
                <button
                  onClick={() => setShowAdminConfig(true)}
                  className="bg-blue-600 text-white px-2 py-1 rounded flex items-center gap-1 hover:bg-blue-700 text-sm whitespace-nowrap"
                  title="Configuració Admin"
                >
                  <Users size={16} />
                  <span className="hidden sm:inline">Config</span>
                </button>
                <button
                  onClick={() => {
                    setEditingAsset(null);
                    setShowModal(true);
                  }}
                  className="bg-purple-600 text-white px-2 py-1 rounded flex items-center gap-1 hover:bg-purple-700 text-sm whitespace-nowrap"
                >
                  <Plus size={16} />
                  <span className="hidden sm:inline">Nou</span>
                </button>
                <button
                  onClick={handleLogoutAdmin}
                  className="bg-red-600 text-white px-2 py-1 rounded flex items-center gap-1 hover:bg-red-700 text-sm whitespace-nowrap"
                  title="Sortir mode Admin"
                >
                  <Lock size={16} />
                  <span className="hidden sm:inline">Sortir</span>
                </button>
              </div>
            ) : currentUser === 'Admin' && !isAdminAuthenticated ? (
              <button
                onClick={() => setShowAdminLogin(true)}
                className="bg-gray-600 text-white px-2 py-1 rounded flex items-center gap-1 hover:bg-gray-700 text-sm whitespace-nowrap"
              >
                <Unlock size={16} />
                <span className="hidden sm:inline">Accés Admin</span>
              </button>
            ) : (
              <div className="flex gap-1">
                <button
                  onClick={() => {
                    setEditingAsset(null);
                    setShowModal(true);
                  }}
                  className="bg-purple-600 text-white px-2 py-1 rounded flex items-center gap-1 hover:bg-purple-700 text-sm whitespace-nowrap"
                >
                  <Plus size={16} />
                  <span className="hidden sm:inline">Nou</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {currentUser === 'Admin' && isAdminAuthenticated && (
          <div className="flex flex-wrap gap-1 md:gap-2">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className={`px-2 py-1 border rounded text-xs flex-1 sm:flex-none sm:min-w-[100px] ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : ''}`}
            >
              <option value="all">Tipus</option>
              {assetTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className={`px-2 py-1 border rounded text-xs flex-1 sm:flex-none sm:min-w-[100px] ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : ''}`}
            >
              <option value="all">Estat</option>
              {Object.entries(STATUSES).map(([key, val]) => (
                <option key={key} value={key}>{val.label}</option>
              ))}
            </select>
            <select
              value={filterUser}
              onChange={(e) => setFilterUser(e.target.value)}
              className={`px-2 py-1 border rounded text-xs flex-1 sm:flex-none sm:min-w-[100px] ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : ''}`}
            >
              <option value="all">Usuari</option>
              {users.map(user => (
                <option key={user} value={user}>{user}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* CONTINGUT PRINCIPAL */}
      <div className={`flex-1 overflow-auto p-3 md:p-4 ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
          {filteredAssets.map((asset, idx) => {
            const safeAsset = ensureStageDetails(asset);
            const isAdmin = currentUser === 'Admin' && isAdminAuthenticated;
            
            const isAssigned = asset.stages?.some(stage => {
              const stageDetail = safeAsset.stageDetails[stage];
              return stageDetail && stageDetail.assignedTo === currentUser;
            }) || false;
            
            const isReviewer = asset.stages?.some(stage => {
              const stageDetail = safeAsset.stageDetails[stage];
              return stageDetail && stageDetail.reviewer === currentUser;
            }) || false;
            
            const hasPendingReviews = asset.stages?.some(stage => {
              const stageDetail = safeAsset.stageDetails[stage];
              if (!stageDetail) return false;
              const stageStatus = stageDetail.status || 'todo';
              const isUserReviewerOfThisStage = stageDetail.reviewer === currentUser;
              return isUserReviewerOfThisStage && ['review', 'needs_fix'].includes(stageStatus);
            });
            
            const hasActiveIssues = asset.issues?.some(issue => !issue.resolved);
            
            const allStagesDone = asset.stages?.every(stage => {
              const stageDetail = safeAsset.stageDetails[stage];
              return stageDetail?.status === 'done';
            }) || false;
            
            const assetNotesList = assetNotes[asset.id] || [];
            
            let borderStyle = '';
            if (isAssigned && isReviewer) {
              borderStyle = 'border-double border-4 border-gradient-to-r from-blue-500 to-yellow-500';
            } else if (isAssigned) {
              borderStyle = darkMode 
                ? 'border-4 border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.5)]' 
                : 'border-4 border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.3)]';
            } else if (isReviewer && hasPendingReviews) {
              borderStyle = darkMode 
                ? 'border-4 border-yellow-500 shadow-[0_0_15px_rgba(245,158,11,0.5)]' 
                : 'border-4 border-yellow-500 shadow-[0_0_15px_rgba(245,158,11,0.3)]';
            }
            
            return (
              <div 
                key={asset.id} 
                className={`rounded-lg shadow-md overflow-hidden transition-all hover:shadow-lg ${
                  hasActiveIssues ? 'border-4 border-red-500' : 
                  allStagesDone ? (darkMode ? 'border-4 border-green-700' : 'border-4 border-green-500') :
                  darkMode ? 'border-2 border-gray-700 bg-gray-800' : 'border-2 border-gray-200 bg-white'
                } ${borderStyle}`}
              >
                {/* HEADER */}
                <div className={`px-3 py-2 border-b ${
                  allStagesDone ? (darkMode ? 'bg-green-900/30 border-green-800' : 'bg-green-50 border-green-200') :
                  darkMode ? 'bg-gradient-to-r from-gray-800 to-gray-900 border-gray-700' : 
                  'bg-gradient-to-r from-gray-50 to-gray-100 border-gray-200'
                }`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`font-mono text-xs ${allStagesDone ? 'text-green-600' : darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                          P{(idx + 1).toString().padStart(3, '0')}
                        </span>
                        <h3 className={`font-bold text-sm truncate ${allStagesDone ? 'text-green-700' : darkMode ? 'text-white' : 'text-gray-800'}`}>
                          {asset.name}
                          {allStagesDone && ' ✅'}
                        </h3>
                      </div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                          darkMode ? 'bg-purple-900 text-purple-300' : 'bg-purple-100 text-purple-700'
                        }`}>
                          {asset.type}
                        </span>
                        {allStagesDone && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                            darkMode ? 'bg-green-900 text-green-300' : 'bg-green-100 text-green-700'
                          }`}>
                            Completat
                          </span>
                        )}
                        {hasActiveIssues && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                            darkMode ? 'bg-red-900 text-red-300' : 'bg-red-100 text-red-700'
                          }`}>
                            Problemes
                          </span>
                        )}
                      </div>
                    </div>
                    
                    {isAdmin && (
                      <div className="flex gap-1 flex-shrink-0">
                        <button 
                          onClick={() => {
                            setEditingAsset(asset);
                            setShowModal(true);
                          }}
                          className={`p-1 rounded hover:opacity-80 ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-200'}`}
                          title="Editar"
                        >
                          <Edit2 size={14} className={darkMode ? 'text-gray-300' : 'text-gray-600'} />
                        </button>
                        <button 
                          onClick={() => {
                            if (window.confirm('Segur que vols eliminar aquest asset?')) {
                              deleteAsset(asset.id);
                            }
                          }}
                          className={`p-1 rounded hover:opacity-80 ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-200'}`}
                          title="Eliminar"
                        >
                          <Trash2 size={14} className="text-red-500" />
                        </button>
                      </div>
                    )}
                  </div>
                  
                  {asset.link && (
                    <div className="mt-2">
                      <a href={asset.link} target="_blank" rel="noopener noreferrer" className="block">
                        <div className={`w-full h-24 rounded border overflow-hidden relative group ${
                          darkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-200 border-gray-300'
                        }`}>
                          {asset.link.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i) ? (
                            <img 
                              src={asset.link} 
                              alt={asset.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                              onError={(e) => {
                                e.target.style.display = 'none';
                              }}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <span className="text-2xl">🔗</span>
                            </div>
                          )}
                        </div>
                      </a>
                    </div>
                  )}
                </div>
                
                {/* ETAPES */}
                <div className="p-3">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {asset.stages?.map((stage, stageIdx) => {
                      const stageDetail = safeAsset.stageDetails[stage] || {};
                      const stageStatus = stageDetail.status || 'todo';
                      const stageAssignedTo = stageDetail.assignedTo || asset.assignedTo;
                      const stageReviewer = stageDetail.reviewer || asset.reviewer;
                      const stageDeadline = stageDetail.deadline || asset.deadline;
                      const stageDaysRemaining = calculateDaysRemaining(stageDeadline);
                      
                      const prevStage = stageIdx > 0 ? asset.stages[stageIdx - 1] : null;
                      const prevStageStatus = prevStage ? 
                        (safeAsset.stageDetails[prevStage]?.status || 'todo') : null;
                      const isStageLocked = prevStage && prevStageStatus !== 'done';
                      
                      const isAssignedToThisStage = stageAssignedTo === currentUser;
                      const isReviewerOfThisStage = stageReviewer === currentUser;
                      
                      const isDone = stageStatus === 'done';
                      const shouldBeLockedForArtist = isDone && isAssignedToThisStage && !isAdmin;
                      
                      return (
                        <div 
                          key={stage} 
                          className={`border-2 rounded p-2 flex flex-col gap-1 min-h-[100px] ${
                            stageStatus === 'needs_fix' ? 
                              (darkMode ? 'border-red-700 bg-red-900/30' : 'border-red-300 bg-red-50') :
                            isDone ?
                              (darkMode ? 'border-green-700 bg-green-900/30' : 'border-green-300 bg-green-50') :
                            isStageLocked && !isAdmin ? 
                              (darkMode ? 'border-gray-700 bg-gray-800/50 opacity-60' : 'border-gray-200 bg-gray-50 opacity-60') : 
                            darkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-300 bg-white'
                          }`}
                        >
                          {/* TÍTOL */}
                          <div className={`text-[10px] font-semibold mb-1 ${
                            stageStatus === 'needs_fix' ? 'text-red-600' :
                            stageStatus === 'done' ? 'text-green-600' :
                            darkMode ? 'text-gray-300' : 'text-gray-600'
                          }`}>
                            {stage}
                          </div>
                          
                          {/* ESTAT */}
                          <div>
                            {(isAdmin || isAssignedToThisStage || isReviewerOfThisStage) && !shouldBeLockedForArtist ? (
                              <select
                                value={stageStatus}
                                onChange={(e) => updateStageDetails(asset.id, stage, { status: e.target.value })}
                                disabled={isStageLocked && !isAdmin}
                                className={`w-full text-[10px] px-1 py-1 rounded border-0 ${
                                  STATUSES[stageStatus]?.[darkMode ? 'darkColor' : 'color'] || 
                                  (darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-700')
                                } ${isStageLocked && !isAdmin ? 'opacity-50 cursor-not-allowed' : ''}`}
                              >
                                {Object.entries(STATUSES).map(([key, val]) => {
                                  if (isAdmin) return <option key={key} value={key}>{val.label}</option>;
                                  
                                  if (!isAssignedToThisStage && !isReviewerOfThisStage) return null;
                                  
                                  if (isAssignedToThisStage && ['cancelled', 'needs_fix', 'done'].includes(key)) return null;
                                  
                                  if (isReviewerOfThisStage && !['review', 'needs_fix', 'done'].includes(key)) return null;
                                  
                                  if (isStageLocked && !isReviewerOfThisStage) return null;
                                  
                                  return <option key={key} value={key}>{val.label}</option>;
                                })}
                              </select>
                            ) : (
                              <div className={`text-[10px] px-1 py-1 rounded text-center ${
                                STATUSES[stageStatus]?.[darkMode ? 'darkColor' : 'color'] || 
                                (darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-700')
                              }`}>
                                {STATUSES[stageStatus]?.label || 'To Do'}
                              </div>
                            )}
                          </div>
                          
                          {/* ASSIGNAT */}
                          <div className="text-[10px]">
                            {isAdmin ? (
                              <select
                                value={stageAssignedTo}
                                onChange={(e) => updateStageDetails(asset.id, stage, { assignedTo: e.target.value })}
                                className={`w-full px-1 py-0.5 text-xs border rounded ${
                                  darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white'
                                }`}
                              >
                                <option value="">Sense assignar</option>
                                {users.filter(u => u !== 'Admin').map(user => (
                                  <option key={user} value={user}>{user}</option>
                                ))}
                              </select>
                            ) : (
                              <div 
                                className={`truncate ${stageAssignedTo === currentUser ? 'font-bold' : ''} ${
                                  stageAssignedTo === currentUser 
                                    ? (darkMode ? 'text-blue-300 bg-blue-900/30 px-1 rounded' : 'text-blue-700 bg-blue-100 px-1 rounded') 
                                    : (darkMode ? 'text-gray-300' : 'text-gray-600')
                                }`} 
                                title={stageAssignedTo}
                              >
                                👤 {stageAssignedTo || 'Sense assignar'}
                                {stageAssignedTo === currentUser && ' ←'}
                              </div>
                            )}
                          </div>
                          
                          {/* REVIEWER */}
                          <div className="text-[10px]">
                            {isAdmin ? (
                              <select
                                value={stageReviewer}
                                onChange={(e) => updateStageDetails(asset.id, stage, { reviewer: e.target.value })}
                                className={`w-full px-1 py-0.5 text-xs border rounded ${
                                  darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white'
                                }`}
                              >
                                <option value="">Sense reviewer</option>
                                {users.map(user => (
                                  <option key={user} value={user}>{user}</option>
                                ))}
                              </select>
                            ) : (
                              <div 
                                className={`truncate ${stageReviewer === currentUser ? 'font-bold' : ''} ${
                                  stageReviewer === currentUser 
                                    ? (darkMode ? 'text-yellow-300 bg-yellow-900/30 px-1 rounded' : 'text-yellow-700 bg-yellow-100 px-1 rounded') 
                                    : (darkMode ? 'text-gray-300' : 'text-gray-600')
                                }`} 
                                title={stageReviewer}
                              >
                                🔍 {stageReviewer || 'Sense reviewer'}
                                {stageReviewer === currentUser && ' ←'}
                              </div>
                            )}
                          </div>
                          
                          {/* DATA LÍMIT */}
                          <div className="text-[10px]">
                            {isAdmin ? (
                              <input
                                type="date"
                                value={stageDeadline || ''}
                                onChange={(e) => updateStageDetails(asset.id, stage, { deadline: e.target.value })}
                                className={`w-full px-1 py-0.5 text-xs border rounded ${
                                  darkMode ? 'bg-gray-700 border-gray-600 text-white' : ''
                                }`}
                              />
                            ) : (
                              <div className={darkMode ? 'text-gray-300' : 'text-gray-600'}>
                                📅 {stageDeadline ? new Date(stageDeadline).toLocaleDateString('ca-ES') : 'Sense data'}
                              </div>
                            )}
                          </div>
                          
                          {/* DIES RESTANTS */}
                          {stageDaysRemaining !== null && (
                            <div className={`text-[10px] font-semibold text-center px-1 py-0.5 rounded ${
                              stageDaysRemaining < 0 ? 
                                (darkMode ? 'bg-red-900/50 text-red-300' : 'bg-red-100 text-red-700') :
                              stageDaysRemaining <= 3 ? 
                                (darkMode ? 'bg-orange-900/50 text-orange-300' : 'bg-orange-100 text-orange-700') :
                                (darkMode ? 'bg-green-900/50 text-green-300' : 'bg-green-100 text-green-700')
                            }`}>
                              {stageDaysRemaining < 0 ? `${Math.abs(stageDaysRemaining)}d end` :
                               stageDaysRemaining === 0 ? 'Avui!' :
                               `${stageDaysRemaining}d`}
                            </div>
                          )}
                          
                          {shouldBeLockedForArtist && (
                            <div className={`text-[8px] text-center mt-1 px-1 py-0.5 rounded ${
                              darkMode ? 'bg-gray-700 text-gray-400' : 'bg-gray-100 text-gray-500'
                            }`}>
                              Etapa finalitzada
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
                
                {/* NOTES */}
                <AssetNotesSection
                  assetId={asset.id}
                  assetType={asset.type}
                  notes={assetNotesList}
                  currentUser={currentUser}
                  onAddNote={addNoteToAsset}
                  darkMode={darkMode}
                />
                
                {/* COMENTARIS I PROBLEMES */}
                {(isAdmin || isAssigned || isReviewer) && (
                  <div className="px-3 pb-3">
                    {asset.comments && asset.comments.length > 0 && (
                      <CommentsPanel
                        assetId={asset.id}
                        comments={asset.comments}
                        currentUser={currentUser}
                        onAddComment={addComment}
                        darkMode={darkMode}
                      />
                    )}
                    
                    {asset.issues && asset.issues.length > 0 && (
                      <IssuesPanel
                        assetId={asset.id}
                        issues={asset.issues}
                        currentUser={currentUser}
                        onAddIssue={addIssue}
                        onResolveIssue={resolveIssue}
                        darkMode={darkMode}
                      />
                    )}
                  </div>
                )}
              </div>
            );
          })}
          
          {filteredAssets.length === 0 && (
            <div className={`col-span-full text-center py-12 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              No hi ha assets que coincideixin amb els filtres
            </div>
          )}
        </div>
      </div>

      {/* MODAL D'ASSET */}
      {showModal && (
        <AssetModal
          asset={editingAsset}
          users={users.filter(u => u !== 'Admin' || isAdminAuthenticated)}
          roles={roles}
          onClose={() => setShowModal(false)}
          onSave={(data) => {
            if (editingAsset) {
              updateAsset(editingAsset.id, data);
            } else {
              if (currentUser === 'Admin' && isAdminAuthenticated) {
                createAsset(data);
              } else {
                alert("Només l'administrador pot crear nous assets.");
              }
            }
            setShowModal(false);
          }}
          darkMode={darkMode}
          currentUser={currentUser}
          isAdminAuthenticated={isAdminAuthenticated}
        />
      )}

      {/* MODAL DE CONFIGURACIÓ D'ADMIN */}
      {showAdminConfig && (
        <AdminConfigModal
          users={users}
          setUsers={setUsers}
          roles={roles}
          setRoles={setRoles}
          assets={assets}
          setAssets={setAssets}
          darkMode={darkMode}
          onClose={() => setShowAdminConfig(false)}
        />
      )}

      {/* MODAL DE LOGIN D'ADMIN */}
      {showAdminLogin && (
        <AdminLogin
          onLogin={handleAdminLogin}
          darkMode={darkMode}
        />
      )}
    </div>
  );
}

// Component Modal d'Asset
function AssetModal({ asset, users, roles, onClose, onSave, darkMode, currentUser, isAdminAuthenticated }) {
  const [formData, setFormData] = useState({
    name: asset?.name || '',
    description: asset?.description || '',
    type: asset?.type || 'Props',
    assignedTo: asset?.assignedTo || (users.filter(u => u !== 'Admin')[0] || users[0]),
    reviewer: asset?.reviewer || '',
    deadline: asset?.deadline || '',
    stages: asset?.stages || ['Modeling'],
    status: asset?.status || 'todo',
    link: asset?.link || ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  const handleStageToggle = (stage) => {
    if (formData.stages.includes(stage)) {
      setFormData({
        ...formData,
        stages: formData.stages.filter(s => s !== stage)
      });
    } else {
      setFormData({
        ...formData,
        stages: [...formData.stages, stage]
      });
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className={`rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
        <div className="p-4 md:p-6">
          <h2 className={`text-2xl font-bold mb-6 ${darkMode ? 'text-white' : 'text-gray-800'}`}>
            {asset ? 'Editar Asset' : 'Nou Asset'}
          </h2>
          
          {!asset && currentUser !== 'Admin' && !isAdminAuthenticated && (
            <div className={`mb-4 p-3 rounded ${darkMode ? 'bg-red-900/30 border border-red-800' : 'bg-red-50 border border-red-200'}`}>
              <p className={`font-semibold ${darkMode ? 'text-red-300' : 'text-red-700'}`}>
                ⚠️ Atenció: Només els administradors poden crear nous assets.
              </p>
            </div>
          )}
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className={`block text-sm font-semibold mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Nom *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className={`w-full px-4 py-2 border rounded-lg ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : ''}`}
                required
                disabled={!asset && currentUser !== 'Admin' && !isAdminAuthenticated}
              />
            </div>

            <div>
              <label className={`block text-sm font-semibold mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Descripció</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className={`w-full px-4 py-2 border rounded-lg ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : ''}`}
                rows="3"
                disabled={!asset && currentUser !== 'Admin' && !isAdminAuthenticated}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={`block text-sm font-semibold mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Tipus</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className={`w-full px-4 py-2 border rounded-lg ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : ''}`}
                  disabled={!asset && currentUser !== 'Admin' && !isAdminAuthenticated}
                >
                  {['Props', 'Personatges', 'Environments', 'Shots'].map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className={`block text-sm font-semibold mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Data límit</label>
                <input
                  type="date"
                  value={formData.deadline}
                  onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                  className={`w-full px-4 py-2 border rounded-lg ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : ''}`}
                  disabled={!asset && currentUser !== 'Admin' && !isAdminAuthenticated}
                />
              </div>
            </div>

            <div>
              <label className={`block text-sm font-semibold mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Link (URL)</label>
              <input
                type="url"
                value={formData.link}
                onChange={(e) => setFormData({ ...formData, link: e.target.value })}
                placeholder="https://..."
                className={`w-full px-4 py-2 border rounded-lg ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : ''}`}
                disabled={!asset && currentUser !== 'Admin' && !isAdminAuthenticated}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={`block text-sm font-semibold mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Assignat a</label>
                <select
                  value={formData.assignedTo}
                  onChange={(e) => setFormData({ ...formData, assignedTo: e.target.value })}
                  className={`w-full px-4 py-2 border rounded-lg ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : ''}`}
                  disabled={!asset && currentUser !== 'Admin' && !isAdminAuthenticated}
                >
                  {users.filter(u => u !== 'Admin').map(user => (
                    <option key={user} value={user}>{user}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className={`block text-sm font-semibold mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Reviewer</label>
                <select
                  value={formData.reviewer}
                  onChange={(e) => setFormData({ ...formData, reviewer: e.target.value })}
                  className={`w-full px-4 py-2 border rounded-lg ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : ''}`}
                  disabled={!asset && currentUser !== 'Admin' && !isAdminAuthenticated}
                >
                  <option value="">Cap</option>
                  {users.map(user => (
                    <option key={user} value={user}>{user}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className={`block text-sm font-semibold mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Etapes</label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {roles.map(stage => (
                  <label key={stage} className={`flex items-center gap-2 p-2 border rounded hover:opacity-90 ${
                    darkMode ? 'border-gray-700 hover:bg-gray-700' : 'border-gray-300 hover:bg-gray-50'
                  } ${(!asset && currentUser !== 'Admin' && !isAdminAuthenticated) ? 'opacity-50 cursor-not-allowed' : ''}`}>
                    <input
                      type="checkbox"
                      checked={formData.stages.includes(stage)}
                      onChange={() => handleStageToggle(stage)}
                      className="w-4 h-4"
                      disabled={!asset && currentUser !== 'Admin' && !isAdminAuthenticated}
                    />
                    <span className={darkMode ? 'text-gray-300' : 'text-gray-700'}>{stage}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                className="flex-1 bg-purple-600 text-white py-2 rounded-lg hover:bg-purple-700 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!asset && currentUser !== 'Admin' && !isAdminAuthenticated}
              >
                {asset ? 'Actualitzar' : 'Crear'}
              </button>
              <button
                type="button"
                onClick={onClose}
                className={`flex-1 py-2 rounded-lg font-semibold ${
                  darkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Cancel·lar
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}