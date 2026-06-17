function normalizeEmail(email) {
    return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

function emailsEqual(left, right) {
    const normalizedLeft = normalizeEmail(left);
    const normalizedRight = normalizeEmail(right);

    return normalizedLeft !== '' && normalizedLeft === normalizedRight;
}

module.exports = {
    normalizeEmail,
    emailsEqual
};
