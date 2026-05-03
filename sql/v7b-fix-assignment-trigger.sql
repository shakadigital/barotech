-- =============================================
-- V7b — FIX: Trigger auto_pause_previous_assignment
-- ✅ SUDAH DIJALANKAN — Jangan jalankan ulang
-- =============================================

-- Hapus trigger lama
DROP TRIGGER IF EXISTS on_assignment_insert ON project_assignments;

-- Update fungsi: paused_by_id diisi setelah insert (AFTER)
CREATE OR REPLACE FUNCTION auto_pause_previous_assignment()
RETURNS TRIGGER AS $$
DECLARE
  v_old_id           UUID;
  v_old_project_name TEXT;
BEGIN
  -- Cari assignment aktif lain untuk karyawan ini (selain yang baru saja diinsert)
  SELECT pa.id, p.name
  INTO v_old_id, v_old_project_name
  FROM project_assignments pa
  JOIN projects p ON p.id = pa.project_id
  WHERE pa.employee_id = NEW.employee_id
    AND pa.status = 'active'
    AND pa.id != NEW.id
  LIMIT 1;

  IF v_old_id IS NOT NULL THEN
    -- Pause assignment lama, referensikan ke assignment baru
    UPDATE project_assignments
    SET
      status       = 'paused',
      end_date     = CURRENT_DATE,
      paused_by_id = NEW.id,
      updated_at   = NOW()
    WHERE id = v_old_id;

    -- Update notes assignment baru jika belum ada
    IF NEW.notes IS NULL OR NEW.notes = '' THEN
      UPDATE project_assignments
      SET notes = 'Pindah Tugas dari: ' || v_old_project_name
      WHERE id = NEW.id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Buat ulang sebagai AFTER INSERT
CREATE TRIGGER on_assignment_insert
  AFTER INSERT ON project_assignments
  FOR EACH ROW EXECUTE FUNCTION auto_pause_previous_assignment();
