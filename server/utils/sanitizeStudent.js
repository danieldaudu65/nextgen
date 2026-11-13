// What the frontend is allowed to see about a student
function sanitizeStudent(student) {
    if (!student) return null;

    const safe =
        typeof student.toObject === 'function'
            ? student.toObject()
            : JSON.parse(JSON.stringify(student));

    safe.id = String(safe._id);

    // Never send these
    delete safe._id;
    delete safe.password;
    delete safe.sample;

    // Mongoose internals
    delete safe.__v;
    delete safe.createdAt;
    delete safe.updatedAt;

    return safe;
}

module.exports = sanitizeStudent;
