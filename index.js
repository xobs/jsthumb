var cpu = require('./cpu.js');
var fs = require('fs');

thumbCpu = new cpu();

function readAppHeader(cpu, offset) {
    return {
        dataLoadStart: cpu.read(offset + 0x00),
        dataStart: cpu.read(offset + 0x04),
        dataEnd: cpu.read(offset + 0x08),
        bssStart: cpu.read(offset + 0x0c),
        bssEnd: cpu.read(offset + 0x10),
        entry: cpu.read(offset + 0x14),
        magic: cpu.read(offset + 0x18),
        version: cpu.read(offset + 0x1c),
        constStart: cpu.read(offset + 0x20),
        constEnd: cpu.read(offset + 0x24),
        heapStart: cpu.read(offset + 0x28),
        heapEnd: cpu.read(offset + 0x2c),
        padding: cpu.read(offset + 0x30)
    };
}

function printAppHeader(header) {
    for (var property in header) {
        if (!header.hasOwnProperty(property)) {
            continue;
        }
        console.log(property + ': 0x' + header[property].toString(16));
    }
}

function loadApp(machine, header) {
    if (header.magic !== 0xd3fbf67a) {
        throw Error('App header magic not found');
    }

    // Load data section
    for (var dataOffset = header.dataStart; dataOffset < header.dataEnd; dataOffset += 4) {
        machine.write(dataOffset, machine.read(header.dataLoadStart + dataOffset));
    }

    for (var bssOffset = header.bssStart; bssOffset < header.bssEnd; bssOffset += 4) {
        machine.write(bssOffset, 0);
    }

    for (var constOffset = header.constStart; constOffset < header.constEnd; header += 4) {
        throw new Error('Constructors not implemented');
    }

    machine.store('pc', header.entry | 1);
    machine.store('sp', machine.ramSize + machine.ramBase - 4);
    machine.store('lr', 0xfffffffc);
}

fs.readFile('hello.bin', null, function (err, flash) {
    if (err) {
        console.error('Unable to read hello.bin: ' + err);
        return;
    }

    // Load the file into the CPU at the specified address.
    for (var i = 0; i < flash.length; i++) {
        thumbCpu.writeb(0x5900 + i, flash[i], {
            flash_we: true
        });
    }

    var header = readAppHeader(thumbCpu, 0x5900);
    //printAppHeader(header);
    loadApp(thumbCpu, header);

    thumbCpu.registerSvc(129, function(cpu) {
        cpu.store('pc', cpu.load('lr'));
    });

    console.log('CPU Starting Condition:');
    thumbCpu.print();

    try {
        while (1) {
            thumbCpu.tick();
        }
    } catch(e) {
        console.log('Error: ' + e);
        thumbCpu.print();
    }
});