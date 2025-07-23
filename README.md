# MongoDB Mongosh Custom Extensions

## 🚀 Overview

This repository contains a `.mongoshrc.js` script designed to enhance your MongoDB Shell (mongosh) experience by providing a suite of custom commands and diagnostic functions. It aims to streamline database administration, monitoring, and troubleshooting tasks directly from your shell.

## ✨ Features

The script introduces a variety of helpful commands, neatly categorized for easy navigation:

### 🔧 Base and Replica Set
* `replStatus()`: Get the current status of your replica set.
* `printClusterType()`: Determine the type of MongoDB cluster you are connected to (Standalone, Replica Set, or Sharded Cluster).
* `checkIndexes()`: Inspect indexes for all collections, including their usage statistics via `$indexStats`.
* `printBackupExamples()`: Display common `mongodump`, `mongorestore`, `mongoexport`, and `mongoimport` examples.

### 🚀 Performance and Monitoring
* `showPerformance()`: Show active operations and key server statistics (connections, memory, network).
* `showLongOperations()`: Identify currently running queries that have exceeded 60 seconds.
* `showOplog()`: Provide information about the oplog for replica sets.
* `showServerStatus()`: Display a comprehensive, summarized overview of the server status.
* `showServerStatusRaw()`: Output the full `db.serverStatus()` object in JSON format.
* `showPerformancesmall()`: A more concise display of server performance metrics.

### 🔐 Security
* `showSecurity()`: List database users and report on authentication and SSL/TLS configuration.
* `showSecurityRaw()`: Output the raw `db.serverStatus().security` object in JSON.

### 💾 Storage and Schema
* `showStorage()`: Present database and collection-level storage statistics (data size, index size, document counts).
* `analyzeSchema('collectionName')`: Analyze a sample of documents from a specified collection to infer its schema and list its indexes.

### 📦 Sharding and Cluster
* `showDatabases()`: List all databases along with their sizes on disk.
* `showShardingStatus()`: Display the status of the sharded cluster (equivalent to `sh.status()`).
* `showCurrentQueries()`: Show all currently active queries.
* `showReplicaLag()`: Report the replication lag for secondary members of a replica set.
* `showStorageEngines()`: Provide details about the configured storage engine.
* `showFailoverCandidates()`: List replica set members that are potential candidates for failover, based on priority and state.
* `showStartupWarnings()`: Retrieve any startup warnings from the MongoDB server log.

### 🛠️ Profiler
* `enableProfiler(slowms = 30)`: Enable the database profiler with an optional `slowms` threshold (default is 30ms).
* `showProfilerData(N = 10)`: Display the last `N` (default is 10) records from the `system.profile` collection, with color-coded timings.
* `disableProfiler()`: Disable the database profiler.

### ❓ Help
* `showHelp()`: Display a list of all custom commands available in this script.

## ✅ Requirements

* **MongoDB Server**: Version 4.0 or higher.
* **MongoDB Shell**: `mongosh` (recommended) or legacy `mongo` shell.

## 📥 Installation

1.  **Download the script**:
    Download the `mongoshrc.js` file from this repository.

2.  **Copy to your home directory**:
    Copy the downloaded file to your user's home directory and rename it to `.mongoshrc.js`. The leading dot (`.`) makes it a hidden file, which is the standard naming convention for shell configuration files.


    For Linux/MacOS:
    ```bash
    cp mongoshrc.js ~/.mongoshrc.js
    ```
    

    For Windows:
     ```bash
     %USERPROFILE%\.mongoshrc.js
     ```
    *Note: If you already have a `.mongoshrc.js` file, consider merging its content or backing it up before replacing it.*
4.  **Automatic Loading**:
    The script will be automatically loaded and executed every time you open a new `mongosh` session.

## 💡 Usage

Once installed, simply open your `mongosh` terminal and type the command you wish to execute.
* For example, to check your replica set status:
    ```javascript
    replStatus()
    ```
* To enable the profiler for queries slower than 100ms:
    ```javascript
    enableProfiler(100)
    ```
* Use the `Tab` key for autocompletion to explore available commands!

## ⚠️ Important Notes

* **Environment**: This script is primarily intended for use in development, testing, and administration environments.
* **Privileges**: Some commands (e.g., `db.currentOp()`, `db.serverStatus()`) may require appropriate administrative privileges (such as the `root` role) to execute successfully.
* **MongoDB Atlas Free Tier**: Certain operations (like `db.currentOp()`) might be restricted or unavailable on MongoDB Atlas Free Tier clusters.

## 📜 License

[Optionally, add your chosen license here, e.g., MIT License]

---
