/*
=======================================================================
 🛠️ .mongoshrc.js – Custom Extensions for MongoDB Shell
=======================================================================

This script adds **quick commands and diagnostic functions** to the MongoDB Shell (mongosh)
to facilitate database administration and monitoring.

✅ REQUIREMENTS:
- MongoDB >= 4.0 (required to ensure compatibility with all commands like db.hello() and $indexStats)
- mongosh or legacy mongo shell

=======================================================================
📥 INSTALLATION
=======================================================================
1. Download the mongoshrc.js file.
2. Copy it to your user's home directory as .mongoshrc.js:

    cp mongoshrc.js ~/.mongoshrc.js

3. Every time you open a mongosh session, the script will be automatically loaded.


🔧 Base and Replica Set
 • replStatus()             - Replica set status
       ↪ rs.status()
 • printClusterType()       - MongoDB cluster type
       ↪ db.hello(), sh.status()
 • checkIndexes()           - Check collection indexes with statistics
       ↪ db.getCollectionNames(), db.collection.getIndexes(), $indexStats
 • printBackupExamples()    - Backup and restore examples
       ↪ mongodump, mongorestore, mongoexport, mongoimport

🚀 Performance and Monitoring
 • showPerformance()        - Active operations and server statistics
       ↪ db.currentOp(), db.serverStatus()
 • showLongOperations()     - Slow queries (>60s)
       ↪ db.currentOp({secs_running:{$gt:60}})
 • showOplog()              - Oplog information (replica set)
       ↪ db.getSiblingDB('local').oplog.rs.stats()
 • showServerStatus()       - Full server status (synthetic)
       ↪ db.serverStatus()
 • showServerStatusRaw()    - Full status in JSON format
       ↪ db.serverStatus()

🔐 Security
 • showSecurity()           - Users and authentication enabled
       ↪ db.getUsers(), db.serverStatus().security
 • showSecurityRaw()        - Security in JSON format
       ↪ db.serverStatus().security

💾 Storage and Schema
 • showStorage()            - Database and collection statistics
       ↪ db.stats(), db.collection.stats()
 • analyzeSchema('coll')    - Analyze sample schema of the collection
       ↪ db.collection.aggregate([{$sample}]), db.collection.getIndexes()

📦 Sharding and Cluster
 • showDatabases()          - List of databases with size
       ↪ db.adminCommand({listDatabases:1})
 • showShardingStatus()     - Sharding status
       ↪ sh.status()
 • showCurrentQueries()     - Active queries
       ↪ db.currentOp({active:true})
 • showReplicaLag()         - Secondary replica lag
       ↪ rs.status(), rs.printSecondaryReplicationInfo()
 • showStorageEngines()     - Storage engine info
       ↪ db.serverStatus().storageEngine
 • showFailoverCandidates() - Failover candidate nodes
       ↪ rs.status()
 • showStartupWarnings()    - MongoDB startup warnings
       ↪ db.adminCommand({getLog:'startupWarnings'})

🛠️ Profiler
 • enableProfiler()         - Enable query profiler
       ↪ db.setProfilingLevel(1, {slowms:30})
 • showProfilerData(N)      - Display last N profiler records
       ↪ db.system.profile.find().sort({ts:-1}).limit(N)
 • disableProfiler()        - Disable query profiler
       ↪ db.setProfilingLevel(0)

❓ Help
 • showHelp()               - Show this list

💡 Tip: use the [Tab] key for autocompletion in mongosh.
============================================================================
*/
/*
=======================================================================
ℹ️ COMPATIBILITY
=======================================================================
⚠️ This script is tested on MongoDB 4.0 and later versions.
On versions <4.0 some functions like db.hello() or $indexStats might not be available.

=======================================================================
📌 NOTES
=======================================================================
- Use the file only in development or administration environments.
- Some functionalities (e.g., currentOp) may require administrator privileges (role: root).
*/


const ICON = {
  WARN: "🚨",
  OK: "✅",
  INFO: "ℹ️",
  TIP: "💡"
};

/**
 * Safely executes function fn and logs errors with label.
 * @param {Function} fn
 * @param {string} label
 * @returns result of fn() or undefined in case of error
 */
function safeRun(fn, label) {
  try {
    return fn();
  } catch (e) {
    print(`${ICON.WARN} Error during ${label}:`, e.message || e);
  }
}

// Flag for detailed startup (heavy checks)
const IS_DETAILED = typeof process !== "undefined" &&
  process.env.MONGOSH_RC_DETAILED === "true";

// ——————————————————————————————
// Utilities grouped in utils
// ——————————————————————————————

const utils = {
  // Prints replica set status
  replStatus() {
    const st = safeRun(() => rs.status(), "rs.status()");
    if (st) printjson(st);
  },
  healthCheck() {
    print(`\n🩺 === HEALTH CHECK ===\n`);
    const hello = safeRun(() => db.hello(), "db.hello()");
    if (!hello) return;
    print(`✅ Active connection: ${hello.isWritablePrimary ? 'Primary' : 'Secondary'}`);
    if (hello.setName) {
      print(`🧬 Replica Set: ${hello.setName}`);
      const st = safeRun(() => rs.status(), "rs.status()");
      if (st) {
        const healthy = st.members.filter(m => m.health === 1).length;
        const total = st.members.length;
        const icon = healthy < total ? ICON.WARN : ICON.OK;
        print(`   ${icon} Healthy members: ${healthy}/${total}`);
        print(`\n📋 Member details:`);
        st.members.forEach(m => {
          const memberIcon = m.health === 1 ? ICON.OK : ICON.WARN;
          const state = m.stateStr || '';
          const role = m.state === 1 ? ' (PRIMARY)' : m.state === 2 ? ' (SECONDARY)' : '';
          print(`   ${memberIcon} ${m.name} - ${state}${role}`);
        });
        const opl = db.getSiblingDB('local').oplog.rs;
        const first = opl.find().sort({
          $natural: 1
        }).limit(1).next().ts.t;
        const last = opl.find().sort({
          $natural: -1
        }).limit(1).next().ts.t;
        const h = Math.round((last - first) / 3600);
        print(`\n⏱️ Oplog window: ${h}h`);
      }
    }
  },

  // Shows indexes for each collection
  // Added to utils:

  checkIndexes() {
    safeRun(() => {
      db.getCollectionNames().forEach(name => {
        print(`\n🗂️  Indexes for collection "${name}":`);
        const idx = db[name].getIndexes();
        idx.forEach(i => print(`   • ${i.name}: ${JSON.stringify(i.key)}`));

        // $indexStats
        print(`📊 Usage statistics (via $indexStats):`);
        const stats = db[name].aggregate([{
          $indexStats: {}
        }]).toArray();
        stats.forEach(s => {
          print(`   • ${s.name}: ${s.accesses.ops} accesses since ${s.accesses.since}`);
        });
      });
    }, "checking indexes with $indexStats");
  },

  enableProfiler(slowms = 30) {
    print(`\n⚙️ === ENABLE PROFILER ===\n`);
    print(`📖 Command executed: db.setProfilingLevel(1, { slowms: ${slowms} })`);
    const res = safeRun(() => db.setProfilingLevel(1, {
      slowms: slowms
    }), "setProfilingLevel enable");
    if (res) print(`✅ Profiler enabled with slowms threshold=${slowms}ms`);
  },
  showProfilerData(limit = 10) {
    print(`\n📖 === PROFILER DATA (last ${limit} records) ===\n`);
    safeRun(() => {
      const profile = db.system.profile
        .find({})
        .sort({
          ts: -1
        })
        .limit(limit)
        .toArray();

      if (profile.length === 0) {
        print(`${ICON.INFO} No data available in system.profile`);
        return;
      }

      profile.forEach((entry, i) => {
        const millis = entry.millis || 0;
        let color = "\x1b[32m"; // 🟢 green for fast operations
        if (millis > 500) {
          color = "\x1b[31m"; // 🔴 red for >500ms
        } else if (millis > 100) {
          color = "\x1b[33m"; // 🟡 yellow for 100-500ms
        }

        print(`${color}#${i + 1} [${entry.ts}] - ${entry.op.toUpperCase()} ${entry.ns}\x1b[0m`);
        print(`   ⚡ Time: ${millis}ms`);
        if (entry.command) {
          print(`   📥 Command: ${JSON.stringify(entry.command)}`);
        } else if (entry.query) {
          print(`   📥 Query: ${JSON.stringify(entry.query)}`);
        }
        print(""); // Empty line for separation
      });
    }, "Reading profiler data");
  },


  disableProfiler() {
    print(`\n⚙️ === DISABLE PROFILER ===\n`);
    print(`📖 Command executed: db.setProfilingLevel(0)`);
    const res = safeRun(() => db.setProfilingLevel(0), "setProfilingLevel disable");
    if (res) print(`✅ Profiler disabled`);
  },


  // Determines cluster type
  printClusterType() {
    const hello = safeRun(() => db.hello(), "db.hello()");
    if (!hello) return;
    let tipo = "❓ Unknown";
    if (hello.msg === "isdbgrid") tipo = "🧩 Sharded Cluster (mongos)";
    else if (hello.setName) tipo = "🧬 Replica Set";
    else if (hello.isWritablePrimary || hello.secondary) tipo = "🔹 Standalone";
    print(`\n🔍 MongoDB cluster type detected: ${tipo}\n`);
    if (hello.msg === "isdbgrid") {
      print(`${ICON.INFO} Connecting via mongos — executing sh.status():`);
      safeRun(() => sh.status(), "sh.status()");
    }
  },
  showServerStatusRaw() {
    print(`\n📝 === SERVER STATUS (JSON RAW) ===\n`);
    const status = safeRun(() => db.serverStatus(), "serverStatus");
    if (status) {
      printjson(status);
    } else {
      print(`${ICON.WARN} Unable to retrieve serverStatus`);
    }
  },

  // Slow queries (>60s)
  showLongOperations() {
    print(`\n⏱️ === PROLONGED OPERATIONS (>60s) ===\n`);
    const ops = safeRun(() => db.currentOp({
      active: true,
      secs_running: {
        $gt: 60
      }
    }), "currentOp slow");
    if (!ops || !ops.inprog || ops.inprog.length === 0) {
      print(`   ${ICON.OK} No prolonged operations`);
    } else {
      ops.inprog.forEach(op => printjson(op));
    }
  },

  // Check version mismatch between nodes
  checkVersions() {
    print(`\n🔢 === VERSION CHECK ===\n`);
    safeRun(() => {
      const info = db.serverBuildInfo();
      print(`   • Local Server: v${info.version}`);
      const members = rs.status().members;
      members.forEach(m => {
        const host = m.name;
        try {
          const conn = new Mongo(`mongodb://${host}/${db.getName()}`);
          const bi = conn.getDB(db.getName()).serverBuildInfo();
          print(`   • ${host}: v${bi.version}`);
        } catch (e) {
          print(`   • ${host}: ${ICON.WARN} not available (connection error)`);
        }
      });
    }, "checkVersions");
  },

  // Active operations and server statistics
  showPerformance() {
    print(`\n🚀 === PERFORMANCE & ACTIVE OPERATIONS ===\n`);
    const uri = db.getMongo()._uri;
    if (uri.includes("mongodb.net")) {
      print(`🔄 Active operations not available on Atlas Tier`);
    } else {
      safeRun(() => {
        print("🔄 Active operations:");
        const ops = db.currentOp({
          active: true
        });
        if (ops.inprog.length === 0) print(`   ${ICON.OK} No active operations at the moment`);
        else printjson(ops);
      }, "currentOp");
    }
    safeRun(() => {
      print(`\n📊 Server statistics:`);
      const s = db.serverStatus();
      print(`   • Connections: ${s.connections.current}/${s.connections.available}`);
      print(`   • Memory: ${Math.round(s.mem.resident)}MB resident, ${Math.round(s.mem.virtual)}MB virtual`);
      print(`   • Uptime: ${Math.floor(s.uptime/3600)}h ${Math.floor((s.uptime%3600)/60)}m`);
      print(`   • Network: ${s.network.bytesIn} bytes in, ${s.network.bytesOut} bytes out`);
    }, "serverStatus");
  },
  showPerformancesmall() {
    safeRun(() => {
      print(`\n📊 Server statistics:`);
      const s = db.serverStatus();
      print(`   • Connections: ${s.connections.current}/${s.connections.available}`);
      print(`   • Memory: ${Math.round(s.mem.resident)}MB resident, ${Math.round(s.mem.virtual)}MB virtual`);
      print(`   • Uptime: ${Math.floor(s.uptime / 3600)}h ${Math.floor((s.uptime % 3600) / 60)}m`);
      print(`   • Network: ${s.network.bytesIn} bytes in, ${s.network.bytesOut} bytes out`);
    }, "serverStatus");
  },


  // Users and SSL status
  showSecurity() {
    print(`\n🔐 === SECURITY & USERS ===\n`);
    safeRun(() => {
      const users = db.getUsers().users || [];
      if (users.length === 0) print(`👤 No users defined`);
      else users.forEach(u => print(`👤 ${u.user} - roles: ${u.roles.map(r => r.role).join(', ')}`));
    }, "getUsers");
    safeRun(() => {
      const sec = db.serverStatus().security || {};
      print(`🔒 Authentication: ${sec.authentication ? 'Enabled' : 'Disabled'}`);
      print(`🔗 SSL Mode: ${sec.sslMode || 'n/a'}`);
    }, "security");
  },

  // Oplog status (Replica Set)
  showOplog() {
    print(`\n📜 === OPLOG INFO ===\n`);
    const hello = safeRun(() => db.hello(), "db.hello()");
    if (hello) {
      print("📖 Result of db.hello():");
      printjson(hello);
    }
    if (!hello || !hello.setName) {
      print(`ℹ️ Oplog only available for Replica Set`);
      return;
    }
    const local = db.getSiblingDB('local').oplog.rs;
    safeRun(() => {
      const o = local.stats();
      print(`   • Oplog size: ${Math.round(o.size/1024/1024)}MB`);
    }, "oplogStats");
  },

  // All combined serverStatus blocks
  showServerStatus() {
    print(`\n💻 === SERVER STATUS ===\n`);
    this.showServerInfo();
    this.showConnections();
    this.showMemory();
    this.showOpcounters();
    this.showWiredTigerCache();
    this.showUptime();
    this.showAsserts();
    this.showLocks();
    this.showNetwork();
    this.showStorageEngine();
    print(`\n✅ End of serverStatus\n`);
  },

  showConnections() {
    print(`\n🌐 === CONNECTIONS ===\n`);
    const status = safeRun(() => db.serverStatus(), "serverStatus");
    if (!status) return;
    const conn = status.connections;
    print(`   • Current: ${conn.current}`);
    print(`   • Available: ${conn.available}`);
    print(`   • Total created: ${conn.totalCreated}`);
    if (conn.current > conn.available * 0.9) {
      print(`⚠️ Nearing connection limit!`);
    }
  },

  showMemory() {
    print(`\n🧠 === MEMORY USAGE ===\n`);
    const status = safeRun(() => db.serverStatus(), "serverStatus");
    if (!status) return;
    const mem = status.mem;
    print(`   • Resident: ${mem.resident} MB`);
    print(`   • Virtual: ${mem.virtual} MB`);
    print(`   • Used percentage: ${Math.round(mem.resident / mem.virtual * 100)}%`);
  },

  showOpcounters() {
    print(`\n📊 === OPCOUNTERS ===\n`);
    const status = safeRun(() => db.serverStatus(), "serverStatus");
    if (!status) return;
    const ops = status.opcounters;
    print(`   • insert: ${ops.insert}`);
    print(`   • query: ${ops.query}`);
    print(`   • update: ${ops.update}`);
    print(`   • delete: ${ops.delete}`);
    print(`   • command: ${ops.command}`);
  },

  showWiredTigerCache() {
    print(`\n📦 === WIREDTIGER CACHE ===\n`);
    const status = safeRun(() => db.serverStatus(), "serverStatus");
    if (!status || !status.wiredTiger) {
      print(`ℹ️ WiredTiger not in use`);
      return;
    }
    const cache = status.wiredTiger.cache;
    print(`   • Bytes in cache: ${Math.round(cache["bytes currently in the cache"]/1024/1024)} MB`);
    print(`   • Max cache size: ${Math.round(cache["maximum bytes configured"]/1024/1024)} MB`);
    print(`   • Used percentage: ${Math.round(cache["bytes currently in the cache"] / cache["maximum bytes configured"] * 100)}%`);
  },

  showUptime() {
    print(`\n⏱️ === UPTIME ===\n`);
    const status = safeRun(() => db.serverStatus(), "serverStatus");
    if (!status) return;
    const uptimeSecs = status.uptime;
    const uptimeHrs = Math.round(uptimeSecs / 3600);
    print(`   • Uptime: ${uptimeHrs} hours (${Math.round(uptimeSecs/60)} minutes)`);
  },

  showAsserts() {
    print(`\n🚨 === ASSERTS ===\n`);
    const status = safeRun(() => db.serverStatus(), "serverStatus");
    if (!status) return;
    const asserts = status.asserts;
    print(`   • Regular: ${asserts.regular}`);
    print(`   • Warning: ${asserts.warning}`);
    print(`   • Msg: ${asserts.msg}`);
    print(`   • User: ${asserts.user}`);
    if (asserts.regular > 0 || asserts.warning > 0) {
      print(`⚠️ Check logs for errors or warnings`);
    }
  },

  showLocks() {
    print(`\n🛡️ === LOCKS ===\n`);
    const status = safeRun(() => db.serverStatus(), "serverStatus");
    if (!status || !status.locks) {
      print(`ℹ️ No lock information`);
      return;
    }
    Object.keys(status.locks).forEach((lockName) => {
      const lock = status.locks[lockName];
      print(`   • ${lockName}: read=${lock.acquireCount?.r || 0}, write=${lock.acquireCount?.w || 0}`);
    });
  },

  showNetwork() {
    print(`\n🌱 === NETWORK ===\n`);
    const status = safeRun(() => db.serverStatus(), "serverStatus");
    if (!status) return;
    const net = status.network;
    print(`   • Bytes received: ${Math.round(net.bytesIn / 1024)} KB`);
    print(`   • Bytes sent: ${Math.round(net.bytesOut / 1024)} KB`);
    print(`   • Packets received: ${net.numRequests}`);
  },

  showStorageEngine() {
    print(`\n🗄️ === STORAGE ENGINE ===\n`);
    const status = safeRun(() => db.serverStatus(), "serverStatus");
    if (!status) return;
    const engine = status.storageEngine;
    print(`   • Name: ${engine.name}`);
    print(`   • Journaling support: ${engine.supportsCommittedReads}`);
  },

  showServerInfo() {
    print(`\n🏁 === SERVER INFO ===\n`);
    const status = safeRun(() => db.serverStatus(), "serverStatus");
    if (!status) return;
    print(`   • MongoDB Version: ${status.version}`);
    print(`   • Hostname: ${status.host}`);
    print(`   • PID: ${status.pid}`);
    print(`   • Process: ${status.process}`);
  },
  showStorageEngines() {
    print(`\n🗄️ === STORAGE ENGINES ===\n`);
    print(`📖 Result of db.serverStatus().storageEngine:`);
    const status = safeRun(() => db.serverStatus(), "db.serverStatus()");
    if (status && status.storageEngine) {
      printjson(status.storageEngine);
    } else {
      print(`${ICON.WARN} No storage engine information`);
    }
  },
  //showFreeMonitoring() {
  //  print(`\n📊 === FREE MONITORING STATUS ===\n`);
  //  print(`📖 Result of db.getFreeMonitoringStatus():`);
  //  safeRun(() => db.getFreeMonitoringStatus(), "getFreeMonitoringStatus");
  //},


  // List of available commands
  showHelp() {
    const coll = db.getCollectionNames()[0] || '<collection_name>';
    print(`\n📚 === AVAILABLE COMMANDS ===\n`);

    // 🔧 Base and Replica Set
    print(`🔧 Base and Replica Set:`);
    print(`   replStatus()             - Replica set status`);
    print(`   printClusterType()       - MongoDB cluster type`);
    print(`   checkIndexes()           - Check collection indexes`);
    print(`   printBackupExamples()    - Backup/restore examples`);

    // 🚀 Performance and Monitoring
    print(`\n🚀 Performance and Monitoring:`);
    print(`   showPerformance()        - Active operations and statistics`);
    print(`   showLongOperations()     - Slow operations (>60s)`);
    print(`   showOplog()              - Oplog information (replica set)`);
    print(`   showServerStatus()       - Full server status`);
    print(`   showServerStatusRaw()    - Full status in JSON format`);

    // 🔐 Security
    print(`\n🔐 Security:`);
    print(`   showSecurity()           - Users and authentication`);
    print(`   showSecurityRaw()        - Security in JSON format`);

    // 💾 Storage and Schema
    print(`\n💾 Storage and Schema:`);
    print(`   showStorage()            - Database and collection statistics`);
    print(`   analyzeSchema('${coll}') - Analyze collection schema`);

    // 📦 Sharding and Cluster
    print(`\n📦 Sharding and Cluster:`);
    print(`   showDatabases()          - List of databases with size`);
    print(`   showShardingStatus()     - Sharding status`);
    print(`   showCurrentQueries()     - Active queries`);
    print(`   showReplicaLag()         - Replica lag`);
    print(`   showStorageEngines()     - Storage engine info`);
    print(`   showFailoverCandidates() - Failover candidates`);
    print(`   showStartupWarnings()    - MongoDB startup warnings`);

    // 🛠️ Profiler
    print(`\n🛠️ Profiler:`);
    print(`   enableProfiler()         - Enable profiler`);
    print(`   showProfilerData(N)      - View N profiler queries`);
    print(`   disableProfiler()        - Disable profiler`);

    // ❓ Help
    print(`\n❓ Help:`);
    print(`   showHelp()               - Show this list`);

    // Final tip
    print(`${ICON.TIP} Tip: use Tab for autocompletion!`);
  },
  showSecurityRaw() {
    print(`\n🔐 === SECURITY (RAW) ===\n`);
    print(`📖 Result of db.serverStatus().security:`);
    const status = safeRun(() => db.serverStatus(), "db.serverStatus()");
    if (status && status.security) {
      printjson(status.security);
    } else {
      print(`${ICON.WARN} No security information available`);
    }
  },
  showStorage() {
    print(`\n💾 === STORAGE & COLLECTIONS ===\n`);
    const stats = safeRun(() => db.stats(), "db.stats()");
    if (!stats) return;
    print(`📊 Database: ${db.getName()}`);
    print(`   • Collections: ${stats.collections}`);
    print(`   • Data size: ${Math.round(stats.dataSize/1024/1024)}MB`);
    print(`   • Storage size: ${Math.round(stats.storageSize/1024/1024)}MB`);
    print(`   • Index size: ${Math.round(stats.indexSize/1024/1024)}MB`);
    print(`   • Total documents: ${stats.objects}`);
    if (stats.collections === 0) {
      print(`\n📝 Empty database - no collections present`);
      print(`💡 Tip: try with a database that contains data`);
      return;
    }
    safeRun(() => {
      print(`\n📋 Collections by size:`);
      db.getCollectionNames().map(name => {
        const s = db[name].stats();
        return {
          name,
          name,
          size: s.size,
          count: s.count,
          idx: s.totalIndexSize
        }
      }).sort((a, b) => b.size - a.size).forEach(c => {
        const sizeStr = c.size > 1024 * 1024 ? `${Math.round(c.size/1024/1024)}MB` : `${Math.round(c.size/1024)}KB`;
        const idxStr = c.idx > 1024 * 1024 ? `${Math.round(c.idx/1024/1024)}MB` : `${Math.round(c.idx/1024)}KB`;
        print(`   • ${c.name}: ${sizeStr} data, ${idxStr} indexes (${c.count} docs)`);
      });
    }, "collectionStats");
  },

  analyzeSchema(coll) {
    if (!coll) {
      print(`${ICON.WARN} Specify a collection: analyzeSchema('name')`);
      return;
    }
    print(`\n🔬 === SCHEMA ANALYSIS: ${coll} ===\n`);
    safeRun(() => {
      const docs = db[coll].aggregate([{
        $sample: {
          size: 3
        }
      }]).toArray();
      docs.forEach((doc, i) => {
        print(`\n--- Example ${i+1} ---`);
        printjson(doc);
      });
      print(`\n📊 Indexes:`);
      db[coll].getIndexes().forEach(ix => print(`   • ${ix.name}: ${JSON.stringify(ix.key)}`));
    }, "analyzeSchema");
  },


  showShardingStatus() {
    print(`\n📦 === SHARDING STATUS ===\n`);
    print(`📖 Result of sh.status():`);
    safeRun(() => sh.status(), "sh.status()");
  },
  showCurrentQueries() {
    print(`\n🔄 === CURRENT QUERIES ===\n`);
    print(`📖 Result of db.currentOp({active:true}):`);
    const ops = safeRun(() => db.currentOp({
      active: true
    }), "currentOp");
    if (ops && ops.inprog.length > 0) {
      ops.inprog.forEach(op => printjson(op));
    } else {
      print(`${ICON.OK} No active queries`);
    }
  },
  showReplicaLag() {
    print(`\n🕒 === REPLICA LAG ===\n`);
    print(`📖 Result of rs.printSecondaryReplicationInfo():`);

    safeRun(() => {
      const status = rs.status();
      if (!status || !status.members) {
        print(`${ICON.WARN} Replica Set not available or error retrieving status`);
        return;
      }

      status.members.forEach(m => {
        if (m.stateStr === "PRIMARY") return; // Skip Primary
        const lag = m.optimeDate ? Math.round((new Date() - m.optimeDate) / 1000) : null;

        let icon = ICON.OK;
        let color = "\x1b[32m"; // green by default
        if (lag === null) {
          icon = ICON.WARN;
          color = "\x1b[33m"; // yellow if unknown
        } else if (lag > 0 && lag <= 30) {
          color = "\x1b[33m"; // 🟡 yellow if lag <=30 sec
        } else if (lag > 30) {
          color = "\x1b[31m"; // 🔴 red if lag >30 sec
          icon = ICON.WARN;
        }

        print(`${color}${icon} ${m.name} - Lag: ${lag !== null ? lag + " sec" : "n/a"}\x1b[0m`);
      });
    }, "ReplicaLag");
  },







  showFailoverCandidates() {
    print(`\n🔄 === FAILOVER CANDIDATES ===\n`);
    print(`📖 Result of rs.status():`);
    const status = safeRun(() => rs.status(), "rs.status()");
    if (status && status.members) {
      status.members.forEach(m => {
        const priority = m.priority !== undefined ? m.priority : 'default';
        print(`   • ${m.name} - Priority: ${priority}, State: ${m.stateStr}`);
      });
    }
  },
  showStartupWarnings() {
    print(`\n⚠️ === STARTUP WARNINGS ===\n`);
    print(`📖 Result of db.adminCommand({getLog:"startupWarnings"}):`);
    const warnings = safeRun(() => db.adminCommand({
      getLog: "startupWarnings"
    }), "getLog startupWarnings");
    if (warnings && warnings.log && warnings.log.length > 0) {
      warnings.log.forEach(w => print(w));
    } else {
      print(`${ICON.OK} No startup warnings`);
    }
  },
  showDatabases() {
    print(`\n🗄️ === DATABASES ===\n`);
    print(`📖 Result of db.adminCommand({listDatabases:1}):`);
    const dbs = safeRun(() => db.adminCommand({
      listDatabases: 1
    }), "listDatabases");
    if (dbs && dbs.databases) {
      dbs.databases.forEach(d => {
        const sizeMB = Math.round(d.sizeOnDisk / 1024 / 1024);
        print(`   • ${d.name}: ${sizeMB}MB, ${d.empty ? 'Empty' : 'With data'}`);
      });
    } else {
      print(`${ICON.WARN} Unable to list databases`);
    }
  },


  printBackupExamples() {
    const dbName = db.getName();
    const collList = db.getCollectionNames();
    const currColl = collList.length ? collList[0] : '<collection_name>';
    print(`\n📦 Backup and restore examples:\n`);
    print(`🔸 mongodump (full backup):`);
    print(`   mongodump --uri="mongodb://user:password@host:27017/${dbName}" --out=/path/to/backup`);
    print(`\n🔸 mongodump of a single collection:`);
    print(`   mongodump --uri="mongodb://user:password@host:27017/${dbName}" --collection=${currColl} --out=/path/to/backup/${currColl}`);
    print(`\n🔸 mongorestore (full restore):`);
    print(`   mongorestore --uri="mongodb://user:password@host:27017/${dbName}" /path/to/backup`);
    print(`\n📝 Export/import examples in JSON format:\n`);
    print(`🔸 mongoexport (export a collection to JSON):`);
    print(`   mongoexport --uri="mongodb://user:password@host:27017/${dbName}" --collection=${currColl} --out=${currColl}.json`);
    print(`\n🔸 mongoimport (import a collection from JSON):`);
    print(`   mongoimport --uri="mongodb://user:password@host:27017/${dbName}" --collection=${currColl} --file=${currColl}.json --jsonArray`);
    print(`\n⚙️  Useful parameters:`);
    print(`   – --uri             : connection string (host, port, credentials)`);
    print(`   – --db              : database name`);
    print(`   – --collection      : collection name`);
    print(`   – --out             : destination for mongodump`);
    print(`   – --file            : input file for mongoimport`);
    print(`   – --gzip            : enable gzip compression`);
    print(`   – --archive         : use single archive instead of folder`);
    print(`   – --jsonArray       : handles JSON array`);
    print(`\n❗ Note: always use mongodump via mongos in a sharded cluster!`);
  }
};

// Global exposure
Object.assign(globalThis, utils);

// ——————————————————————————————
// Initialization and prompt
// ——————————————————————————————
;(function init() {
  utils.printClusterType();
  utils.healthCheck(); // ✅ now definitely there
  utils.showPerformancesmall();
  utils.showServerInfo();
  utils.showHelp();
  print(`\n📦 Connected to: ${db.getName()}`);
})();
