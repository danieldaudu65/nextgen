// Logged-in students carry their token in an httpOnly cookie (JavaScript in the page can't read it).
const isProd = () => process.env.NODE_ENV === 'production';

// name: 'token' for students, 'admin_token' for the NextGen team
function setAuthCookie(res, token, name = 'token') {
    res.cookie(name, token, {
        httpOnly: true,
        secure: isProd(),
        sameSite: isProd() ? 'none' : 'lax',
        maxAge: 1000 * 60 * 60 * 24 * 30, // 30 days
    });
}

function clearAuthCookie(res, name = 'token') {
    res.clearCookie(name, { httpOnly: true, secure: isProd(), sameSite: isProd() ? 'none' : 'lax' });
}

module.exports = { setAuthCookie, clearAuthCookie };
