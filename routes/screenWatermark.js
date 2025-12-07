const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// Validate license and activate/check-in device
router.post('/validate-license', async (req, res) => {
  const { license_key, device_id, watermark_text } = req.body;

  if (!license_key || !device_id) {
    return res.status(400).json({ valid: false, message: 'Missing license_key or device_id' });
  }

  try {
    // 1. Check if license exists and is active
    const { data: license, error: licenseError } = await supabase
      .from('screen_licenses')
      .select('*')
      .eq('license_key', license_key)
      .single();

    if (licenseError || !license) {
      return res.json({ valid: false, message: 'Invalid license key' });
    }

    if (license.status !== 'active') {
      return res.json({ valid: false, message: 'License has been cancelled' });
    }

    // 2. Check if trial has expired
    if (license.plan_type === 'trial' && license.trial_expires_at) {
      const now = new Date();
      const expiresAt = new Date(license.trial_expires_at);
      if (now > expiresAt) {
        return res.json({ valid: false, message: 'Trial has expired' });
      }
    }

    // 3. Check if device already exists for THIS license
    const { data: existingDevice } = await supabase
      .from('screen_active_devices')
      .select('*')
      .eq('device_id', device_id)
      .eq('license_key', license_key)
      .single();

    if (existingDevice) {
      // Device already activated for this license - just update last_checkin
      await supabase
        .from('screen_active_devices')
        .update({ last_checkin: new Date().toISOString() })
        .eq('device_id', device_id)
        .eq('license_key', license_key);

      return res.json({ 
        valid: true, 
        message: 'Device authorized',
        watermark_text: license.watermark_text 
      });
    }

    // 4. New device - check if seats available
    const { data: activeDevices } = await supabase
      .from('screen_active_devices')
      .select('*')
      .eq('license_key', license_key);

    if (activeDevices.length >= license.seat_count) {
      return res.json({ valid: false, message: 'No available seats. Please contact support to add more seats.' });
    }

    // 5. Activate new device
    if (!watermark_text) {
      return res.status(400).json({ valid: false, message: 'watermark_text required for new device activation' });
    }

    await supabase
      .from('screen_active_devices')
      .insert({
        license_key,
        device_id,
        watermark_text
      });

    return res.json({ 
      valid: true, 
      message: 'Device activated successfully',
      watermark_text 
    });

  } catch (error) {
    console.error('Error validating license:', error);
    return res.status(500).json({ valid: false, message: 'Server error' });
  }
});

module.exports = router;
