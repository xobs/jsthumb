'use strict';

var Thumb2CPU = function (opts, cb) {
    if (!opts) {
        opts = new Object();
    }

    if (!cb) {
        cb = function () {};
    }

    this.ramSize = opts.ramSize || 4096;
    this.ramBase = 0x20000000;
    this.flashSize = opts.flashSize || 32768;

    this.ram = new Uint8Array(this.ramSize);
    this.ram.forEach(element => {
        element = 0;
    });

    this.flash = new Uint8Array(this.flashSize);

    this.svc = new Array();

    this.reset();
}

// Fix a word.
// Work around Javascript's tendency to make integers signed.
function fw(w) {
    if (w < 0)
        return 0x100000000 + w;
    return w;
}

Thumb2CPU.prototype = {
    reset: function () {
        this.pc = 0;
        this.lr = 0;
        for (var i = 0; i < 16; i++) {
            this['r' + i] = 0;
        }
        this.msp = 0;
        this.psp = 0;
        this.primask = 0;
    },

    regDecode: function (reg) {
        if ((reg >= 0) && (reg <= 15)) {
            return reg;
        }
        if (reg === 'pc') {
            return 15;
        }
        if (reg === 'lr') {
            return 14;
        }
        if (reg === 'sp') {
            return 13;
        }
        throw new Error('Unrecognized register name: ' + reg);
    },

    store: function (reg, val) {
        reg = this.regDecode(reg);
        this['r' + reg] = val;
    },

    load: function (reg) {
        reg = this.regDecode(reg);
        return this['r' + reg];
    },

    read: function (offset) {
        if (offset & 3) {
            throw new Error('Address 0x' + offset.toString(16) + ' not divisible by 4');
        }
        var val;
        if (offset < this.flashSize - 4) {
            val = ((this.flash[offset + 3] << 24) & 0xff000000) |
                ((this.flash[offset + 2] << 16) & 0x00ff0000) |
                ((this.flash[offset + 1] << 8) & 0x0000ff00) |
                ((this.flash[offset + 0] << 0) & 0x000000ff);
        } else if ((offset >= this.ramBase) && (offset < ((this.ramBase + this.ramSize)))) {
            offset -= this.ramBase;
            val = ((this.ram[offset + 3] << 24) & 0xff000000) |
                ((this.ram[offset + 2] << 16) & 0x00ff0000) |
                ((this.ram[offset + 1] << 8) & 0x0000ff00) |
                ((this.ram[offset + 0] << 0) & 0x000000ff);
        } else {
            throw new Error('Address 0x' + offset.toString(16) + ' out of range');
        }
        if (val < 0)
            val = 0x100000000 + val;
        return val;
    },

    readw: function (offset) {
        if (offset & 1) {
            throw new Error('Address 0x' + offset.toString(16) + ' not divisible by 2');
        }
        var val;
        if (offset < this.flashSize - 2) {
            val = ((this.flash[offset + 1] << 8) & 0x0000ff00) |
                ((this.flash[offset + 0] << 0) & 0x000000ff);
        } else if ((offset >= this.ramBase) && (offset < ((this.ramBase + this.ramSize)))) {
            offset -= this.ramBase;
            val = ((this.ram[offset + 1] << 8) & 0x0000ff00) |
                ((this.ram[offset + 0] << 0) & 0x000000ff);
        } else {
            throw new Error('Address 0x' + offset.toString(16) + ' out of range');
        }
        if (val < 0)
            val = 0x10000 + val;
        return val;
    },

    readb: function (offset) {
        var val;
        if (offset < this.flashSize - 1) {
            val = ((this.flash[offset + 0] << 0) & 0x000000ff);
        } else if ((offset >= this.ramBase) && (offset < ((this.ramBase + this.ramSize)))) {
            offset -= this.ramBase;
            val = ((this.ram[offset + 0] << 0) & 0x000000ff);
        } else {
            throw new Error('Address 0x' + offset.toString(16) + ' out of range');
        }
        if (val < 0)
            val = 0x100 + val;
        return val;
    },

    write: function (offset, value, opt) {
        var opt = opt || {};
        var flash_we = opt.flash_we || false;
        if (offset & 3) {
            throw new Error('Address 0x' + offset.toString(16) + ' not divisible by 4');
        }
        if ((offset < this.flashSize - 4) && flash_we) {
            this.flash[offset + 0] = value >> 0;
            this.flash[offset + 1] = value >> 8;
            this.flash[offset + 2] = value >> 16;
            this.flash[offset + 3] = value >> 24;
        } else if ((offset >= this.ramBase) && (offset < ((this.ramBase + this.ramSize)))) {
            offset -= this.ramBase;
            this.ram[offset + 0] = value >> 0;
            this.ram[offset + 1] = value >> 8;
            this.ram[offset + 2] = value >> 16;
            this.ram[offset + 3] = value >> 24;
        } else {
            throw new Error('Address 0x' + offset.toString(16) + ' out of range');
        }
    },

    writew: function (offset, value, opt) {
        var opt = opt || {};
        var flash_we = opt.flash_we || false;
        if (offset & 1) {
            throw new Error('Address 0x' + offset.toString(16) + ' not divisible by 2');
        }
        if ((offset < this.flashSize - 2) && flash_we) {
            this.flash[offset + 0] = value >> 0;
            this.flash[offset + 1] = value >> 8;
        } else if ((offset >= this.ramBase) && (offset < ((this.ramBase + this.ramSize)))) {
            offset -= this.ramBase;
            this.ram[offset + 0] = value >> 0;
            this.ram[offset + 1] = value >> 8;
        } else {
            throw new Error('Address 0x' + offset.toString(16) + ' out of range');
        }
    },

    writeb: function (offset, value, opt) {
        var flash_we = opt.flash_we || false;

        if ((offset < this.flashSize - 1) && flash_we) {
            this.flash[offset + 0] = value >> 0;
        } else if ((offset >= this.ramBase) && (offset < ((this.ramBase + this.ramSize)))) {
            offset -= this.ramBase;
            this.ram[offset + 0] = value >> 0;
        } else {
            throw new Error('Address 0x' + offset.toString(16) + ' out of range');
        }
    },

    print: function () {
        for (var i = 0; i <= 12; i++) {
            console.log('r' + i + ': 0x' + this['r' + i].toString(16));
        }
        console.log('sp: 0x' + this.load('sp').toString(16));
        console.log('lr: 0x' + this.load('lr').toString(16));
        console.log('pc: 0x' + this.load('pc').toString(16));
    },

    registerSvc: function(n, cb) {
        this.svc[n] = cb;
    },

    tick: function () {
        var pc = this.load('pc');
        var inst = this.readw(pc - 1);
        if (inst < 0)
            inst = 0x10000 + inst;

        pc += 2;
        this.store('pc', pc);

        // 16-bit unconditional branch
        if ((inst & 0xf800) === 0xf800) {

        }

        // 32-bit instruction
        else if ((inst & 0xe000) === 0xe000) {
            //inst |= this.readw(pc - 1) << 16;
            inst = fw((inst << 16) | this.readw(pc - 1));

            pc += 2;
            this.store('pc', pc);

            console.log('32-bit instruction: ' + inst.toString(16));

            // bx
            if (fw(inst & 0xf800d000) === 0xf000d000) {
                var imm10 = fw((inst >> 16) & 0x3ff);
                var imm11 = fw(inst & 0x7ff);
                var j1 = (inst >> 13) & 1;
                var j2 = (inst >> 11) & 1;
                var s = (inst >> 26) & 1;

                var i1 = !(j1 ^ s);
                var i2 = !(j2 ^ s);

                // S12HHHHHHHHHHLLLLLLLLLLL0
                var target = (imm10 << 12) | (imm11 << 1);
                if (i2)
                    target |= (1 << 22);
                if (i1)
                    target |= (1 << 23);
                if (s)
                    target |= (1 << 24);
                target += this.load('pc');
                console.log('bx #' + target.toString(16));// + ' (s: ' + s + ', j1: ' + j1 + ', j2: ' + j2 + ' i1: ' + i1 + ', i2: ' + i2 + ')');

                this.store('lr', pc);
                this.store('pc', target);
            }

            // blx
            else if (fw(inst & 0xf800d000) === 0xf000c000) {
                console.log('blx');
            }

            // Unhandled
            else {
                console.log('Unhandled 32-bit instruction (' + fw(inst & 0xf800d000).toString(16) + ')');
            }
        }

        // Other 16-bit instruction
        else {
            // SVC
            if ((inst & 0xff00) === 0xdf00) {
                var svc = inst & 0xff;
                console.log('svc #' + svc);
                if (typeof(this.svc[svc]) !== 'function') {
                    throw new Error('No SVC handler for svc #' + svc);
                }
                this.svc[svc](this);
            }
            // Branch / Exchange
            else if ((inst & 0xf800) === 0x4700) {
                console.log('Rm: ' + inst & 0xff);
                console.log('L: ' + inst >> 7);
                throw new Error('Unimplemented');
            }
            // push
            else if ((inst & 0xfe00) === 0xb400) {
                // Store 'lr' if specified
                var mn = 'push {';
                if (inst & (1 << 8)) {
                    this.write(this.load('sp'), this.load('lr'));
                    this.store('sp', this.load('sp') - 4);
                    mn += ', lr';
                }
                for (var i = 7; i >= 0; i--) {
                    if (inst & (1 << i)) {
                        this.write(this.load('sp'), this['r' + i]);
                        this.store('sp', this.load('sp') - 4);
                        mn += ', r' + i;
                    }
                }
                mn += '}';
                console.log(mn);
            }
            // mov immediate
            else if ((inst & 0xf800) === 0x2000) {
                var rd = (inst >> 8) & 7;
                var imm = inst & 0xff;
                console.log('movs  r' + rd + ', #' + imm);
            }

            // load immediate (ldr Rd, [pc, #imm])
            else if ((inst & 0xf800) === 0x4800) {
                var rd = (inst >> 8) & 7;
                var imm = ((inst & 0xff) << 2);
                console.log('ldr  r' + rd + ', [pc, #' + imm + ']) (0x' + (pc + imm - 1).toString(16) + ': 0x' + this.read((pc + imm - 1) & ~3).toString(16) + ')');
            }

            // Unimplemented
            else {
                throw new Error('Unrecognized opcode: ' + inst.toString(16));
            }
        }
    }
}

module.exports = Thumb2CPU;