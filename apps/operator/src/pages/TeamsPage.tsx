import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import type { Team, Sport } from '@pkg/types';

interface TeamsPageProps {
  orgId: string;
  orgSport: Sport;
}

export function TeamsPage({ orgId, orgSport }: TeamsPageProps) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [formData, setFormData] = useState<Partial<Team>>({
    name: '',
    short_name: '',
    logo: '',
    colors: {},
    display_overrides: {}
  });

  useEffect(() => {
    loadTeams();
  }, [orgId]);

  async function loadTeams() {
    setLoading(true);
    const { data, error } = await supabase
      .from('teams')
      .select('*')
      .eq('org_id', orgId)
      .order('name');

    if (error) {
      console.error('Error loading teams:', error);
    } else {
      setTeams(data || []);
    }
    setLoading(false);
  }

  async function handleSave() {
    if (!formData.name) return;

    if (editing) {
      const { error } = await supabase
        .from('teams')
        .update({
          name: formData.name,
          short_name: formData.short_name || null,
          logo: formData.logo || null,
          colors: formData.colors,
          display_overrides: formData.display_overrides
        })
        .eq('id', editing);

      if (error) {
        console.error('Error updating team:', error);
      } else {
        await loadTeams();
        setEditing(null);
        resetForm();
      }
    } else if (creating) {
      const { error } = await supabase
        .from('teams')
        .insert({
          org_id: orgId,
          name: formData.name,
          short_name: formData.short_name || null,
          logo: formData.logo || null,
          colors: formData.colors,
          display_overrides: formData.display_overrides || {}
        });

      if (error) {
        console.error('Error creating team:', error);
      } else {
        await loadTeams();
        setCreating(false);
        resetForm();
      }
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this team?')) return;

    const { error } = await supabase
      .from('teams')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting team:', error);
    } else {
      await loadTeams();
    }
  }

  function resetForm() {
    setFormData({
      name: '',
      short_name: '',
      logo: '',
      colors: {},
      display_overrides: {}
    });
  }

  function startEdit(team: Team) {
    setEditing(team.id);
    setFormData({
      name: team.name,
      short_name: team.short_name || '',
      logo: team.logo || '',
      colors: team.colors || {},
      display_overrides: team.display_overrides || {}
    });
  }

  function cancelEdit() {
    setEditing(null);
    setCreating(false);
    resetForm();
  }

  if (loading) return <div className="p-4">Loading teams...</div>;

  return (
    <div className="p-4 max-w-4xl">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">Teams</h2>
        {!creating && !editing && (
          <button
            onClick={() => setCreating(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Add Team
          </button>
        )}
      </div>

      {(creating || editing) && (
        <div className="mb-6 p-4 border rounded bg-gray-50">
          <h3 className="text-lg font-semibold mb-3">
            {creating ? 'Create Team' : 'Edit Team'}
          </h3>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1">Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border rounded"
                placeholder="Team name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Short Name</label>
              <input
                type="text"
                value={formData.short_name}
                onChange={(e) => setFormData({ ...formData, short_name: e.target.value })}
                className="w-full px-3 py-2 border rounded"
                placeholder="e.g., PSG, FCB"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Logo URL</label>
              <input
                type="text"
                value={formData.logo}
                onChange={(e) => setFormData({ ...formData, logo: e.target.value })}
                className="w-full px-3 py-2 border rounded"
                placeholder="https://..."
              />
            </div>
            <div className="flex gap-4 mt-4">
              <button
                onClick={handleSave}
                disabled={!formData.name}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
              >
                Save
              </button>
              <button
                onClick={cancelEdit}
                className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {teams.length === 0 ? (
          <p className="text-gray-500">No teams yet. Create one to get started.</p>
        ) : (
          teams.map((team) => (
            <div key={team.id} className="flex items-center justify-between p-3 border rounded bg-white">
              <div className="flex items-center gap-3">
                {team.logo && (
                  <img src={team.logo} alt={team.name} className="w-10 h-10 object-contain" />
                )}
                <div>
                  <div className="font-semibold">{team.name}</div>
                  {team.short_name && (
                    <div className="text-sm text-gray-500">{team.short_name}</div>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => startEdit(team)}
                  className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(team.id)}
                  className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
