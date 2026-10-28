const w = f => (req, res, next) => Promise.resolve(f(req, res, next)).catch(next);
const E = (status, msg) => Object.assign(new Error(msg), { status });
const flash = (req, type, msg) => { req.session.flash = { type, msg }; };
module.exports = { w, E, flash };
