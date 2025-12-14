import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, X, Check, AlertTriangle } from "lucide-react";
import { getProjects, createProject, updateProject, deleteProject, Project } from "../../lib/db";

const PRESET_COLORS = [
  "#3B82F6", // blue
  "#22C55E", // green
  "#F59E0B", // amber
  "#EC4899", // pink
  "#8B5CF6", // purple
  "#EF4444", // red
  "#14B8A6", // teal
  "#F97316", // orange
];

export default function SettingsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(PRESET_COLORS[0]);
  const [deleteConfirm, setDeleteConfirm] = useState<Project | null>(null);

  useEffect(() => {
    loadProjects();
  }, []);

  async function loadProjects() {
    try {
      const data = await getProjects();
      setProjects(data);
    } catch (error) {
      console.error("Failed to load projects:", error);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCreate() {
    if (!newName.trim()) return;
    try {
      await createProject(newName.trim(), newColor);
      setNewName("");
      setNewColor(PRESET_COLORS[0]);
      setIsAdding(false);
      await loadProjects();
    } catch (error) {
      console.error("Failed to create project:", error);
    }
  }

  async function handleUpdate() {
    if (!editingId || !editName.trim()) return;
    try {
      await updateProject(editingId, editName.trim(), editColor);
      setEditingId(null);
      await loadProjects();
    } catch (error) {
      console.error("Failed to update project:", error);
    }
  }

  async function handleDelete() {
    if (!deleteConfirm) return;
    try {
      await deleteProject(deleteConfirm.id);
      setDeleteConfirm(null);
      await loadProjects();
    } catch (error) {
      console.error("Failed to delete project:", error);
    }
  }

  function startEditing(project: Project) {
    setEditingId(project.id);
    setEditName(project.name);
    setEditColor(project.color);
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <span className="text-gray-400">Loading...</span>
      </div>
    );
  }

  return (
    <div className="p-8">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-gray-400 text-sm mt-1">Manage your projects and preferences</p>
      </header>

      {/* Projects section */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-medium">Projects</h2>
          {!isAdding && (
            <button
              onClick={() => setIsAdding(true)}
              className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition-colors"
            >
              <Plus size={16} />
              Add Project
            </button>
          )}
        </div>

        <div className="bg-[#252525] rounded-xl overflow-hidden">
          {/* Add new project form */}
          {isAdding && (
            <div className="px-5 py-4 border-b border-white/5 bg-[#2a2a2a]">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <input
                    type="color"
                    value={newColor}
                    onChange={(e) => setNewColor(e.target.value)}
                    className="sr-only"
                    id="new-color"
                  />
                  <label
                    htmlFor="new-color"
                    className="w-8 h-8 rounded-full cursor-pointer block border-2 border-white/20"
                    style={{ backgroundColor: newColor }}
                  />
                </div>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Project name"
                  className="flex-1 bg-[#1a1a1a] border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreate();
                    if (e.key === "Escape") setIsAdding(false);
                  }}
                />
                <button
                  onClick={handleCreate}
                  className="p-2 hover:bg-white/10 rounded-lg text-green-500"
                >
                  <Check size={18} />
                </button>
                <button
                  onClick={() => setIsAdding(false)}
                  className="p-2 hover:bg-white/10 rounded-lg text-gray-400"
                >
                  <X size={18} />
                </button>
              </div>
              {/* Color presets */}
              <div className="flex gap-2 mt-3 ml-12">
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => setNewColor(color)}
                    className={`w-6 h-6 rounded-full transition-transform ${
                      newColor === color ? "ring-2 ring-white ring-offset-2 ring-offset-[#2a2a2a]" : ""
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Project list */}
          {projects.length === 0 ? (
            <div className="text-gray-400 text-center py-8">
              No projects yet. Add one to get started.
            </div>
          ) : (
            projects.map((project, index) => (
              <div
                key={project.id}
                className={`px-5 py-4 ${
                  index !== projects.length - 1 ? "border-b border-white/5" : ""
                }`}
              >
                {editingId === project.id ? (
                  // Edit mode
                  <div>
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <input
                          type="color"
                          value={editColor}
                          onChange={(e) => setEditColor(e.target.value)}
                          className="sr-only"
                          id={`edit-color-${project.id}`}
                        />
                        <label
                          htmlFor={`edit-color-${project.id}`}
                          className="w-8 h-8 rounded-full cursor-pointer block border-2 border-white/20"
                          style={{ backgroundColor: editColor }}
                        />
                      </div>
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="flex-1 bg-[#1a1a1a] border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleUpdate();
                          if (e.key === "Escape") setEditingId(null);
                        }}
                      />
                      <button
                        onClick={handleUpdate}
                        className="p-2 hover:bg-white/10 rounded-lg text-green-500"
                      >
                        <Check size={18} />
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="p-2 hover:bg-white/10 rounded-lg text-gray-400"
                      >
                        <X size={18} />
                      </button>
                    </div>
                    {/* Color presets */}
                    <div className="flex gap-2 mt-3 ml-12">
                      {PRESET_COLORS.map((color) => (
                        <button
                          key={color}
                          onClick={() => setEditColor(color)}
                          className={`w-6 h-6 rounded-full transition-transform ${
                            editColor === color
                              ? "ring-2 ring-white ring-offset-2 ring-offset-[#252525]"
                              : ""
                          }`}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                  </div>
                ) : (
                  // View mode
                  <div className="flex items-center gap-4 group">
                    <span
                      className="w-4 h-4 rounded-full shrink-0"
                      style={{ backgroundColor: project.color }}
                    />
                    <span className="flex-1 font-medium">{project.name}</span>
                    <button
                      onClick={() => startEditing(project)}
                      className="p-2 hover:bg-white/10 rounded-lg text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(project)}
                      className="p-2 hover:bg-white/10 rounded-lg text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Delete confirmation modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-[#252525] rounded-xl p-6 max-w-sm w-full mx-4 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                <AlertTriangle size={20} className="text-red-500" />
              </div>
              <h3 className="text-lg font-semibold">Delete Project</h3>
            </div>
            <p className="text-gray-300 mb-2">
              Are you sure you want to delete <strong>{deleteConfirm.name}</strong>?
            </p>
            <p className="text-gray-400 text-sm mb-6">
              All time entries for this project will also be permanently deleted.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 rounded-lg bg-[#1a1a1a] hover:bg-[#303030] text-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
