module.exports.PermissionFlags = {
    next : 1,
    reply : 1 << 1,
    populate : 1 << 2,
    reset : 1 << 3,
    count : 1 << 4,
    admin : this.next | this.reply | this.populate | this.reset | this.count
}