import express from 'express';
import { dbOps } from '../db.js';

export function createApiRouter(io) {
  const router = express.Router();

  // Helper middleware for admin authentication
  const requireAdmin = (req, res, next) => {
    const authHeader = req.headers.authorization || '';
    const pin = req.headers['x-admin-pin'] || (authHeader.startsWith('Bearer ') ? authHeader.substring(7) : '');
    const currentPin = dbOps.getSetting('admin_pin') || 'kaarthi2026';

    if (pin && pin === currentPin) {
      return next();
    }
    return res.status(401).json({ error: 'Unauthorized. Invalid Coach PIN.' });
  };

  // -------------------------------------------------------------
  // PUBLIC ENDPOINTS
  // -------------------------------------------------------------

  // 1. Get Live Site & Slot Stats
  router.get('/stats', (req, res) => {
    try {
      const stats = dbOps.getStats();
      res.json({ success: true, stats });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 2. Submit Consultation Request
  router.post('/leads', (req, res) => {
    try {
      const {
        name, age, gender, phone, email, instagram,
        occupation, struggles, goal, plan, workout_time, budget, payment_method,
        experience, message, macro_profile
      } = req.body;

      if (!name || !phone || !email || !goal) {
        return res.status(400).json({ error: 'Missing required consultation fields (name, phone, email, goal)' });
      }

      const newLead = dbOps.createLead({
        name,
        age: age ? parseInt(age, 10) : null,
        gender: gender || 'Not specified',
        phone,
        email,
        instagram: instagram || '',
        occupation: occupation || 'Working person',
        struggles: struggles || message || '',
        goal,
        plan: plan || 'Coaching Program',
        workout_time: workout_time || 'Flexible',
        budget: budget || 'Flexible',
        payment_method: payment_method || 'UPI',
        experience: experience || 'Intermediate',
        message: message || struggles || '',
        macro_profile
      });

      // Real-time broadcast to Coach Admin dashboard
      io.to('admin_room').emit('lead:new', newLead);
      
      // Real-time broadcast updated stats
      const stats = dbOps.getStats();
      io.emit('stats:updated', stats);

      res.status(201).json({
        success: true,
        message: 'Consultation request received successfully',
        lead: newLead
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 3. Track consultation status with ref_code (e.g. KL-9021)
  router.get('/leads/track/:refCode', (req, res) => {
    try {
      const lead = dbOps.getLeadByRef(req.params.refCode);
      if (!lead) {
        return res.status(404).json({ error: 'Consultation reference not found' });
      }
      res.json({
        success: true,
        ref_code: lead.ref_code,
        name: lead.name,
        plan: lead.plan,
        status: lead.status,
        created_at: lead.created_at
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 4. Get Chat History for a Visitor Session
  router.get('/chat/:sessionId', (req, res) => {
    try {
      const history = dbOps.getChatHistory(req.params.sessionId);
      res.json({ success: true, history });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 5. Post Chat Message (REST Fallback)
  router.post('/chat/:sessionId', (req, res) => {
    try {
      const { sender, text, sender_name } = req.body;
      if (!text || !sender) {
        return res.status(400).json({ error: 'Sender and text are required' });
      }

      const msg = dbOps.saveChatMessage(req.params.sessionId, sender, text, sender_name);
      
      // Emit via Socket.io
      io.to(`chat_${req.params.sessionId}`).emit('chat:message', msg);
      io.to('admin_room').emit('chat:activity', { sessionId: req.params.sessionId, message: msg });

      res.status(201).json({ success: true, message: msg });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // -------------------------------------------------------------
  // ADMIN AUTH & CONTROL ENDPOINTS
  // -------------------------------------------------------------

  // Admin Login
  router.post('/admin/login', (req, res) => {
    const { pin } = req.body;
    const currentPin = dbOps.getSetting('admin_pin') || 'kaarthi2026';

    if (pin === currentPin) {
      return res.json({
        success: true,
        token: pin,
        coach: 'Kaarthi Lifts Command Center'
      });
    }
    return res.status(401).json({ success: false, error: 'Invalid PIN' });
  });

  // Get all leads
  router.get('/admin/leads', requireAdmin, (req, res) => {
    try {
      const leads = dbOps.getAllLeads();
      res.json({ success: true, leads });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Update lead status and notes
  router.patch('/admin/leads/:id', requireAdmin, (req, res) => {
    try {
      const { status, notes } = req.body;
      const updated = dbOps.updateLeadStatus(req.params.id, status, notes);

      // Real-time broadcast to admin and status tracking clients
      io.to('admin_room').emit('lead:updated', updated);
      io.emit(`lead_status:${updated.ref_code}`, { ref_code: updated.ref_code, status: updated.status });

      res.json({ success: true, lead: updated });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Delete lead
  router.delete('/admin/leads/:id', requireAdmin, (req, res) => {
    try {
      dbOps.deleteLead(req.params.id);
      io.to('admin_room').emit('lead:deleted', { id: Number(req.params.id) });
      res.json({ success: true, message: 'Lead removed' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Update live settings (Slots, batch name, coach online status)
  router.put('/admin/settings', requireAdmin, (req, res) => {
    try {
      const { batch_name, total_slots, slots_remaining, coach_status, admin_pin } = req.body;

      if (batch_name !== undefined) dbOps.setSetting('batch_name', batch_name);
      if (total_slots !== undefined) dbOps.setSetting('total_slots', total_slots);
      if (slots_remaining !== undefined) dbOps.setSetting('slots_remaining', slots_remaining);
      if (coach_status !== undefined) dbOps.setSetting('coach_status', coach_status);
      if (admin_pin !== undefined && admin_pin.length >= 4) dbOps.setSetting('admin_pin', admin_pin);

      const stats = dbOps.getStats();

      // Real-time broadcast to EVERY visitor browser
      io.emit('stats:updated', stats);
      io.to('admin_room').emit('settings:updated', dbOps.getAllSettings());

      res.json({ success: true, stats, settings: dbOps.getAllSettings() });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get recent chat conversations
  router.get('/admin/chats', requireAdmin, (req, res) => {
    try {
      const sessions = dbOps.getRecentChatSessions();
      res.json({ success: true, sessions });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}
