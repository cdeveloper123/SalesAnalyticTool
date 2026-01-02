import { useState, useEffect } from 'react';
import { FiSave, FiTrash2, FiCheck } from 'react-icons/fi';
import Modal from './Modal';
import Input from './Input';
import Button from './Button';
import { getPresets, savePreset, deletePreset } from '../services/assumptionService';
import toast from 'react-hot-toast';
import type { AssumptionPreset, AssumptionOverrides } from '../types/assumptions';

interface AssumptionPresetManagerProps {
  currentOverrides: AssumptionOverrides;
  onApplyPreset: (overrides: AssumptionOverrides) => void;
}

export default function AssumptionPresetManager({
  currentOverrides,
  onApplyPreset
}: AssumptionPresetManagerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [presets, setPresets] = useState<AssumptionPreset[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [presetName, setPresetName] = useState('');
  const [presetDescription, setPresetDescription] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadPresets();
    }
  }, [isOpen]);

  const loadPresets = async () => {
    setIsLoading(true);
    try {
      const response = await getPresets();
      console.log('Presets response:', response); // Debug log
      if (response.success && response.data) {
        setPresets(Array.isArray(response.data) ? response.data : []);
      } else {
        // Empty response is fine - just means no presets exist yet
        setPresets([]);
      }
    } catch (error) {
      console.error('Error loading presets:', error);
      // Only show error for actual errors, not for empty results or 404
      if (error instanceof Error && !error.message.includes('404') && !error.message.includes('not found')) {
        toast.error('Failed to load presets');
      }
      // Always set empty array on error (no presets available)
      setPresets([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSavePreset = async () => {
    if (!presetName.trim()) {
      toast.error('Please enter a preset name');
      return;
    }

    setIsLoading(true);
    try {
      const response = await savePreset({
        name: presetName,
        description: presetDescription || undefined,
        ...currentOverrides
      });
      console.log('Save preset response:', response); // Debug log
      setPresetName('');
      setPresetDescription('');
      setSaveModalOpen(false);
      toast.success('Preset saved successfully!');
      // Small delay to ensure database write completes
      setTimeout(async () => {
        await loadPresets();
      }, 500);
    } catch (error) {
      console.error('Error saving preset:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to save preset');
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplyPreset = async (preset: AssumptionPreset) => {
    setIsLoading(true);
    try {
      const overrides: AssumptionOverrides = {
        shippingOverrides: preset.shippingOverrides,
        dutyOverrides: preset.dutyOverrides,
        feeOverrides: preset.feeOverrides
      };
      onApplyPreset(overrides);
      setIsOpen(false);
    } catch (error) {
      console.error('Error applying preset:', error);
      toast.error('Failed to apply preset');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeletePreset = async (presetId: string, presetName: string) => {
    if (!confirm(`Are you sure you want to delete preset "${presetName}"?`)) {
      return;
    }

    setIsLoading(true);
    try {
      await deletePreset(presetId);
      toast.success('Preset deleted successfully');
      await loadPresets();
    } catch (error) {
      console.error('Error deleting preset:', error);
      toast.error('Failed to delete preset');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Button
        variant="secondary"
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2"
      >
        <FiSave size={16} />
        Manage Presets
      </Button>

      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Assumption Presets"
      >
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-gray-400 text-sm">
              Save and load assumption override presets
            </p>
            <Button
              variant="primary"
              onClick={() => setSaveModalOpen(true)}
              className="flex items-center gap-2"
            >
              <FiSave size={16} />
              Save Current
            </Button>
          </div>

          {isLoading && presets.length === 0 ? (
            <div className="text-center py-8 text-gray-400">Loading presets...</div>
          ) : presets.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              No presets saved yet. Save your current assumptions to create one.
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto custom-scrollbar">
              {presets.map((preset) => (
                <div
                  key={preset.id}
                  className="bg-gray-750 border border-gray-700 rounded-lg p-4 flex items-center justify-between"
                >
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-300">{preset.name}</h4>
                    {preset.description && (
                      <p className="text-sm text-gray-400 mt-1">{preset.description}</p>
                    )}
                    <div className="flex gap-4 mt-2 text-xs text-gray-500">
                      {preset.shippingOverrides && (
                        <span>Shipping: {Array.isArray(preset.shippingOverrides) ? preset.shippingOverrides.length : 1}</span>
                      )}
                      {preset.dutyOverrides && (
                        <span>Duty: {Array.isArray(preset.dutyOverrides) ? preset.dutyOverrides.length : 1}</span>
                      )}
                      {preset.feeOverrides && (
                        <span>Fees: {Array.isArray(preset.feeOverrides) ? preset.feeOverrides.length : 1}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="primary"
                      onClick={() => handleApplyPreset(preset)}
                      className="flex items-center gap-1"
                      disabled={isLoading}
                    >
                      <FiCheck size={14} />
                      Apply
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => {
                        if (preset.id) {
                          handleDeletePreset(preset.id, preset.name);
                        }
                      }}
                      className="flex items-center gap-1 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                      disabled={isLoading || !preset.id}
                    >
                      <FiTrash2 size={14} />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>

      {/* Save Preset Modal */}
      <Modal
        isOpen={saveModalOpen}
        onClose={() => {
          setSaveModalOpen(false);
          setPresetName('');
          setPresetDescription('');
        }}
        title="Save Assumption Preset"
      >
        <div className="space-y-4">
          <Input
            label="Preset Name"
            value={presetName}
            onChange={(e) => setPresetName(e.target.value)}
            placeholder="e.g., China to US Standard"
            required
          />
          <Input
            label="Description (Optional)"
            value={presetDescription}
            onChange={(e) => setPresetDescription(e.target.value)}
            placeholder="Brief description of this preset"
          />
          <div className="flex justify-end gap-4 pt-4 border-t border-gray-700">
            <Button
              variant="secondary"
              onClick={() => {
                setSaveModalOpen(false);
                setPresetName('');
                setPresetDescription('');
              }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleSavePreset}
              disabled={!presetName.trim() || isLoading}
            >
              {isLoading ? 'Saving...' : 'Save Preset'}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

