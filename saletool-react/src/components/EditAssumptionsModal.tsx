import { useState, useEffect } from 'react';
import { FiLoader } from 'react-icons/fi';
import toast from 'react-hot-toast';
import Modal from './Modal';
import AssumptionControlPanel from './AssumptionControlPanel';
import AssumptionPresetManager from './AssumptionPresetManager';
import Button from './Button';
import { saveOverrides, getOverrides } from '../services/assumptionService';
import type { AssumptionOverrides } from '../types/assumptions';

interface EditAssumptionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  dealId: string;
  supplierRegion?: string;
  onSave?: () => void; // Callback to refresh data after save
}

export default function EditAssumptionsModal({
  isOpen,
  onClose,
  dealId,
  supplierRegion = 'CN',
  onSave
}: EditAssumptionsModalProps) {
  const [overrides, setOverrides] = useState<AssumptionOverrides>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Load existing overrides when modal opens
  useEffect(() => {
    if (isOpen && dealId) {
      loadOverrides();
    } else {
      // Reset when modal closes
      setOverrides({});
    }
  }, [isOpen, dealId]);

  const loadOverrides = async () => {
    setIsLoading(true);
    try {
      const result = await getOverrides(undefined, dealId);
      // Handle both response formats: { success: true, data: {...} } or direct data
      const overrideData = result.success ? result.data : result;
      
      if (overrideData) {
        setOverrides({
          shippingOverrides: overrideData.shippingOverrides || undefined,
          dutyOverrides: overrideData.dutyOverrides || undefined,
          feeOverrides: overrideData.feeOverrides || undefined,
        });
      } else {
        // No existing overrides, start with empty
        setOverrides({});
      }
    } catch (error) {
      console.error('Error loading overrides:', error);
      // If 404, that's fine - no overrides exist yet
      if (error instanceof Error && error.message.includes('404')) {
        setOverrides({});
      } else {
        toast.error('Failed to load existing overrides');
        setOverrides({});
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!dealId) {
      toast.error('Deal ID is required');
      return;
    }

    setIsSaving(true);
    try {
      await saveOverrides(overrides, dealId);
      toast.success('Assumption overrides updated successfully!');
      
      // Call callback to refresh data if provided
      if (onSave) {
        onSave();
      }
      
      onClose();
    } catch (error) {
      console.error('Error saving overrides:', error);
      toast.error(
        error instanceof Error ? error.message : 'Failed to save overrides'
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Assumption Overrides"
    >
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-3">
            <FiLoader className="animate-spin text-blue-400" size={32} />
            <span className="text-gray-400">Loading existing overrides...</span>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
            <p className="text-sm text-blue-300">
              Modify assumption overrides for this deal. Changes will be saved and tracked in history.
            </p>
          </div>

          <AssumptionControlPanel
            overrides={overrides}
            onChange={setOverrides}
            supplierRegion={supplierRegion}
          />

          <AssumptionPresetManager
            currentOverrides={overrides}
            onApplyPreset={(presetOverrides) => {
              setOverrides(presetOverrides);
              toast.success('Preset applied successfully!');
            }}
          />

          <div className="flex justify-end gap-4 pt-6 border-t border-gray-700">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={handleSave}
              disabled={isSaving}
              isLoading={isSaving}
            >
              {isSaving ? (
                <span className="flex items-center gap-2">
                  <FiLoader className="animate-spin" size={18} />
                  Saving...
                </span>
              ) : (
                'Save Changes'
              )}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

