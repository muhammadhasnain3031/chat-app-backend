const router  = require('express').Router();
const Message = require('../models/Message');
const User    = require('../models/User');
const auth    = require('../middleware/auth');

// Sare users ki list (current user ke alawa)
router.get('/users', auth, async (req, res) => {
  const users = await User.find({ _id: { $ne: req.user.id } })
    .select('name email isOnline avatar');
  res.json(users);
});

// Do users ke beech purani messages
router.get('/messages/:userId', auth, async (req, res) => {
  const messages = await Message.find({
    $or: [
      { sender: req.user.id,       receiver: req.params.userId },
      { sender: req.params.userId, receiver: req.user.id },
    ]
  }).sort({ createdAt: 1 }); // purani pehle

  // Messages ko read mark karo
  await Message.updateMany(
    { sender: req.params.userId, receiver: req.user.id, read: false },
    { read: true }
  );

  res.json(messages);
});

// Unread count
router.get('/unread', auth, async (req, res) => {
  const counts = await Message.aggregate([
    { $match: { receiver: require('mongoose').Types.ObjectId(req.user.id), read: false } },
    { $group: { _id: '$sender', count: { $sum: 1 } } }
  ]);
  res.json(counts);
});

module.exports = router;