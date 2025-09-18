const { getDatabase } = require('../config/database');

class Equipment {
    constructor(data) {
        this.id = data.id;
        this.type = data.type;
        this.model = data.model;
        this.status = data.status || 'ready';
        this.priority = data.priority || 'normal';
        this.planned_start = data.planned_start;
        this.planned_end = data.planned_end;
        this.actual_start = data.actual_start;
        this.actual_end = data.actual_end;
        this.delay_hours = data.delay_hours || 0;
        this.malfunction = data.malfunction || '';
        this.mechanic_name = data.mechanic_name || '';
        this.progress = data.progress || 0;
        this.created_at = data.created_at;
        this.updated_at = data.updated_at;
    }

    static async findAll() {
        return new Promise((resolve, reject) => {
            const db = getDatabase();
            db.all('SELECT * FROM equipment ORDER BY id', [], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows.map(row => new Equipment(row)));
                }
            });
        });
    }

    static async findById(id) {
        return new Promise((resolve, reject) => {
            const db = getDatabase();
            db.get('SELECT * FROM equipment WHERE id = ?', [id], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row ? new Equipment(row) : null);
                }
            });
        });
    }

    static async findByStatus(status) {
        return new Promise((resolve, reject) => {
            const db = getDatabase();
            db.all('SELECT * FROM equipment WHERE status = ?', [status], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows.map(row => new Equipment(row)));
                }
            });
        });
    }

    static async getStats() {
        return new Promise((resolve, reject) => {
            const db = getDatabase();
            const query = `
        SELECT 
          status,
          COUNT(*) as count
        FROM equipment 
        GROUP BY status
      `;

            db.all(query, [], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    const stats = {
                        in_repair: 0,
                        ready: 0,
                        waiting: 0,
                        scheduled: 0,
                        total: 0
                    };

                    rows.forEach(row => {
                        stats[row.status] = row.count;
                        stats.total += row.count;
                    });

                    resolve(stats);
                }
            });
        });
    }

    async save() {
        return new Promise((resolve, reject) => {
            const db = getDatabase();

            if (this.created_at) {
                // Update existing
                const query = `
          UPDATE equipment SET 
            type = ?, model = ?, status = ?, priority = ?,
            planned_start = ?, planned_end = ?, actual_start = ?, actual_end = ?,
            delay_hours = ?, malfunction = ?, mechanic_name = ?, progress = ?,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `;

                db.run(query, [
                    this.type, this.model, this.status, this.priority,
                    this.planned_start, this.planned_end, this.actual_start, this.actual_end,
                    this.delay_hours, this.malfunction, this.mechanic_name, this.progress,
                    this.id
                ], function (err) {
                    if (err) reject(err);
                    else resolve(this);
                });
            } else {
                // Create new
                const query = `
          INSERT INTO equipment 
          (id, type, model, status, priority, planned_start, planned_end, 
           actual_start, actual_end, delay_hours, malfunction, mechanic_name, progress)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

                db.run(query, [
                    this.id, this.type, this.model, this.status, this.priority,
                    this.planned_start, this.planned_end, this.actual_start, this.actual_end,
                    this.delay_hours, this.malfunction, this.mechanic_name, this.progress
                ], function (err) {
                    if (err) reject(err);
                    else resolve(this);
                });
            }
        });
    }

    static async delete(id) {
        return new Promise((resolve, reject) => {
            const db = getDatabase();
            db.run('DELETE FROM equipment WHERE id = ?', [id], function (err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.changes > 0);
                }
            });
        });
    }
}

module.exports = Equipment;