 const { getDatabase } = require('../config/database');
const bcrypt = require('bcryptjs');

class User {
    constructor(data) {
        this.id = data.id;
        this.username = data.username;
        this.password = data.password;
        this.role = data.role || 'user';
        this.full_name = data.full_name || '';
        this.created_at = data.created_at;
        this.last_login = data.last_login;
    }

    static async findAll() {
        return new Promise((resolve, reject) => {
            const db = getDatabase();
            db.all(
                'SELECT id, username, role, full_name, created_at, last_login FROM users ORDER BY created_at DESC',
                [],
                (err, rows) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(rows.map(row => new User(row)));
                    }
                }
            );
        });
    }

    static async findById(id) {
        return new Promise((resolve, reject) => {
            const db = getDatabase();
            db.get('SELECT * FROM users WHERE id = ?', [id], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row ? new User(row) : null);
                }
            });
        });
    }

    static async findByUsername(username) {
        return new Promise((resolve, reject) => {
            const db = getDatabase();
            db.get('SELECT * FROM users WHERE username = ?', [username], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row ? new User(row) : null);
                }
            });
        });
    }

    async validatePassword(password) {
        return bcrypt.compare(password, this.password);
    }

    async save() {
        return new Promise(async (resolve, reject) => {
            const db = getDatabase();

            // Хешируем пароль если он изменился
            if (this.password && !this.password.startsWith('$2')) {
                this.password = await bcrypt.hash(this.password, 10);
            }

            if (this.id) {
                // Update existing user
                const query = `
          UPDATE users SET 
            username = ?, role = ?, full_name = ?,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `;

                db.run(query, [
                    this.username, this.role, this.full_name, this.id
                ], function (err) {
                    if (err) reject(err);
                    else resolve(this);
                });
            } else {
                // Create new user
                const query = `
          INSERT INTO users (username, password, role, full_name)
          VALUES (?, ?, ?, ?)
        `;

                db.run(query, [
                    this.username, this.password, this.role, this.full_name
                ], function (err) {
                    if (err) reject(err);
                    else {
                        this.id = this.lastID;
                        resolve(this);
                    }
                });
            }
        });
    }

    async updateLastLogin() {
        return new Promise((resolve, reject) => {
            const db = getDatabase();
            db.run(
                'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?',
                [this.id],
                function (err) {
                    if (err) reject(err);
                    else resolve(this);
                }
            );
        });
    }

    static async delete(id) {
        return new Promise((resolve, reject) => {
            const db = getDatabase();
            db.run('DELETE FROM users WHERE id = ?', [id], function (err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.changes > 0);
                }
            });
        });
    }

    // Убираем пароль из JSON ответа
    toJSON() {
        const { password, ...userWithoutPassword } = this;
        return userWithoutPassword;
    }
}

module.exports = User;