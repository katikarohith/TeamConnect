const router = require('express').Router();

const render = (view, title) => (req, res) => res.render(view, { title, path: req.path });

router.get('/', (req, res) => res.redirect('/dashboard'));
router.get('/login', render('auth/login', 'Sign in'));
router.get('/register', render('auth/register', 'Create your account'));
router.get('/dashboard', render('dashboard/index', 'Dashboard'));
router.get('/teams', render('teams/index', 'Teams'));
router.get('/teams/:id', render('teams/detail', 'Team workspace'));
router.get('/chat', render('teams/detail', 'Team chat'));
router.get('/tasks', render('tasks/index', 'Tasks'));
router.get('/profile', render('profile/index', 'Your profile'));

module.exports = router;
