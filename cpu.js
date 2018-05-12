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

    instructionDecodeTable16: [
        {
            mask: 0xffc0,
            value: 0x0000,
            mnemonic: 'mov',
            rm: 0x38,
            rn: 0,
            rd: 0x03,
            imm: 0
        },
        {
            mask: 0xffc0,
            value: 0x4000,
            mnemonic: 'and',
            rm: 0x38,
            rn: 0x7,
            rd: 0x7,
            imm: 0
        },
        {
            mask: 0xffc0,
            value: 0x4040,
            mnemonic: 'eor',
            rm: 0x38,
            rn: 0x7,
            rd: 0x7,
            imm: 0
        },
        {
            mask: 0xffc0,
            value: 0x4080,
            mnemonic: 'lsl',
            rm: 0x38,
            rn: 0x7,
            rd: 0x7,
            imm: 0
        },
        {
            mask: 0xffc0,
            value: 0x40c0,
            mnemonic: 'lsr',
            rm: 0x38,
            rn: 0x7,
            rd: 0x7,
            imm: 0
        },
        {
            mask: 0xffc0,
            value: 0x4100,
            mnemonic: 'asr',
            rm: 0x38,
            rn: 0x7,
            rd: 0x7,
            imm: 0
        },
        {
            mask: 0xffc0,
            value: 0x4140,
            mnemonic: 'adc',
            rm: 0x38,
            rn: 0x7,
            rd: 0x7,
            imm: 0
        },
        {
            mask: 0xffc0,
            value: 0x4180,
            mnemonic: 'sbc',
            rm: 0x38,
            rn: 0x7,
            rd: 0x7,
            imm: 0
        },
        {
            mask: 0xffc0,
            value: 0x41c0,
            mnemonic: 'ror',
            rm: 0x38,
            rn: 0x7,
            rd: 0x7,
            imm: 0
        },
        {
            mask: 0xffc0,
            value: 0x4200,
            mnemonic: 'tst',
            rm: 0x38,
            rn: 0x7,
            rd: 0x7,
            imm: 0
        },
        {
            mask: 0xffc0,
            value: 0x4240,
            mnemonic: 'rsb',
            rm: 0x38,
            rn: 0x7,
            rd: 0x7,
            imm: 0
        },
        {
            mask: 0xffc0,
            value: 0x4280,
            mnemonic: 'cmp',
            rm: 0x38,
            rn: 0x7,
            rd: 0x7,
            imm: 0
        },
        {
            mask: 0xffc0,
            value: 0x42c0,
            mnemonic: 'cmn',
            rm: 0x38,
            rn: 0x7,
            rd: 0x7,
            imm: 0
        },
        {
            mask: 0xffc0,
            value: 0x4300,
            mnemonic: 'orr',
            rm: 0x38,
            rn: 0x7,
            rd: 0x7,
            imm: 0
        },
        {
            mask: 0xffc0,
            value: 0x4340,
            mnemonic: 'mul',
            rm: 0x38,
            rn: 0x7,
            rd: 0x7,
            imm: 0
        },
        {
            mask: 0xffc0,
            value: 0x4380,
            mnemonic: 'bic',
            rm: 0x38,
            rn: 0x7,
            rd: 0x7,
            imm: 0
        },
        {
            mask: 0xffc0,
            value: 0x43c0,
            mnemonic: 'mvn',
            rm: 0x38,
            rn: 0x7,
            rd: 0x7,
            imm: 0
        },
        {
            description: 'Sign extend halfword',
            mask: 0xffc0,
            value: 0xb200,
            mnemonic: 'sxth',
            rm: 0x38,
            rn: 0,
            rd: 0x7,
            imm: 0,
        },
        {
            description: 'Sign extend byte',
            mask: 0xffc0,
            value: 0xb240,
            mnemonic: 'sxtb',
            rm: 0x38,
            rn: 0,
            rd: 0x7,
            imm: 0,
        },
        {
            description: 'Unsigned extend halfword',
            mask: 0xffc0,
            value: 0xb280,
            mnemonic: 'uxth',
            rm: 0x38,
            rn: 0,
            rd: 0x7,
            imm: 0,
        },
        {
            description: 'Unsigned extend byte',
            mask: 0xffc0,
            value: 0xb2c0,
            mnemonic: 'uxtb',
            rm: 0x38,
            rn: 0,
            rd: 0x7,
            imm: 0,
        },
        {
            mask: 0xff80,
            value: 0x4700,
            mnemonic: 'bx',
            rm: 0x78,
            rn: 0,
            rd: 0,
            imm: 0
        },
        {
            mask: 0xff80,
            value: 0x4780,
            mnemonic: 'blx',
            rm: 0x78,
            rn: 0,
            rd: 0,
            imm: 0
        },
        {
            description: 'Add to SP',
            mask: 0xff80,
            value: 0xb000,
            mnemonic: 'add'
            rm: 0,
            rn: 0,
            rd: 0,
            imm: 0x7f
        },
        {
            description: 'Subtract from SP',
            mask: 0xff80,
            value: 0xb080,
            mnemonic: 'sub'
            rm: 0,
            rn: 0,
            rd: 0,
            imm: 0x7f
        },
        {
            mask: 0xff00,
            value: 0x4400,
            mnemonic: 'add',
            rm: 0x78,
            rn: 0x83,
            rd: 0x83,
            imm: 0
        },
        {
            // Special data processing
            mask: 0xff00,
            value: 0x4500,
            mnemonic: 'cmp',
            rm: 0x78,
            rn: 0x83,
            rd: 0x83,
            imm: 0
        },
        {
            mask: 0xff00,
            value: 0x4600,
            mnemonic: 'mov',
            rm: 0x78,
            rn: 0x83,
            rd: 0x83,
            imm: 0
        },
        {
            description: 'Branch if equal',
            mask: 0xff00,
            value: 0xd00,
            mnemonic: 'beq',
            rm: 0,
            rn: 0,
            rd: 0,
            imm: 0xff
        },
        {
            description: 'Branch if equal',
            mask: 0xff00,
            value: 0xd000,
            mnemonic: 'beq',
            rm: 0,
            rn: 0,
            rd: 0,
            imm: 0xff
        },
        {
            description: 'Branch if not equal',
            mask: 0xff00,
            value: 0xd100,
            mnemonic: 'bne',
            rm: 0,
            rn: 0,
            rd: 0,
            imm: 0xff
        },
        {
            description: 'Branch if carry set',
            mask: 0xff00,
            value: 0xd200,
            mnemonic: 'bcs',
            rm: 0,
            rn: 0,
            rd: 0,
            imm: 0xff
        },
        {
            description: 'Branch if carry clear',
            mask: 0xff00,
            value: 0xd300,
            mnemonic: 'bcc',
            rm: 0,
            rn: 0,
            rd: 0,
            imm: 0xff
        },
        {
            description: 'Branch if negative',
            mask: 0xff00,
            value: 0xd400,
            mnemonic: 'bmi',
            rm: 0,
            rn: 0,
            rd: 0,
            imm: 0xff
        },
        {
            description: 'Branch if positive-or-zero',
            mask: 0xff00,
            value: 0xd500,
            mnemonic: 'bpl',
            rm: 0,
            rn: 0,
            rd: 0,
            imm: 0xff
        },
        {
            description: 'Branch if overflow',
            mask: 0xff00,
            value: 0xd600,
            mnemonic: 'bvs',
            rm: 0,
            rn: 0,
            rd: 0,
            imm: 0xff
        },
        {
            description: 'Branch if no overflow',
            mask: 0xff00,
            value: 0xd700,
            mnemonic: 'bvc',
            rm: 0,
            rn: 0,
            rd: 0,
            imm: 0xff
        },
        {
            description: 'Branch if unsigned higher',
            mask: 0xff00,
            value: 0xd800,
            mnemonic: 'bhi',
            rm: 0,
            rn: 0,
            rd: 0,
            imm: 0xff
        },
        {
            description: 'Branch if unsigned lower or the same',
            mask: 0xff00,
            value: 0xd900,
            mnemonic: 'bls',
            rm: 0,
            rn: 0,
            rd: 0,
            imm: 0xff
        },
        {
            description: 'Branch if signed greater than or equal',
            mask: 0xff00,
            value: 0xda00,
            mnemonic: 'bgt',
            rm: 0,
            rn: 0,
            rd: 0,
            imm: 0xff
        },
        {
            description: 'Branch if signed less than',
            mask: 0xff00,
            value: 0xdb00,
            mnemonic: 'blt',
            rm: 0,
            rn: 0,
            rd: 0,
            imm: 0xff
        },
        {
            description: 'Branch if signed greater than',
            mask: 0xff00,
            value: 0xdc00,
            mnemonic: 'bgr',
            rm: 0,
            rn: 0,
            rd: 0,
            imm: 0xff
        },
        {
            description: 'Branch if signed less than or equal',
            mask: 0xff00,
            value: 0xdd00,
            mnemonic: 'ble',
            rm: 0,
            rn: 0,
            rd: 0,
            imm: 0xff
        },
        {
            description: 'Branch always',
            mask: 0xff00,
            value: 0xde00,
            mnemonic: 'bal',
            rm: 0,
            rn: 0,
            rd: 0,
            imm: 0xff
        },
        {
            description: 'Branch always',
            mask: 0xff00,
            value: 0xdf00,
            mnemonic: 'b',
            rm: 0,
            rn: 0,
            rd: 0,
            imm: 0xff
        },
        {
            mask: 0xff00,
            value: 0xdf00,
            mnemonic: 'svc',
            rm: 0,
            rn: 0,
            rd: 0,
            imm: 0xff
        },
        {
            mask: 0xff00,
            value: 0xbe00,
            mnemonic: 'bkpt',
            rm: 0,
            rn: 0,
            rd: 0,
            imm: 0xff
        },
        {
            mask: 0xfe00,
            value: 0x1800,
            mnemonic: 'add',
            rm: 0x1c0,
            rn: 0x38,
            rd: 0x70,
            imm: 0
        },
        {
            mask: 0xfe00,
            value: 0x1a00,
            mnemonic: 'sub',
            rm: 0x1c0,
            rn: 0x38,
            rd: 0x70,
            imm: 0
        },
        {
            mask: 0xfe00,
            value: 0x1c00,
            mnemonic: 'add',
            rm: 0,
            rn: 0x38,
            rd: 0x70,
            imm: 0x1c0
        },
        {
            // Subtract immediate
            mask: 0xfe00,
            value: 0x1e00,
            mnemonic: 'sub',
            rm: 0,
            rn: 0x38,
            rd: 0x70,
            imm: 0x1c0
        },
        {
            // Store word (Register offset)
            mask: 0xfe00,
            value: 0x5000,
            mnemonic: 'str',
            rm: 0x1c0,
            rn: 0x038,
            rd: 0x007,
            imm: 0
        },
        {
            // Store halfword (Register offset)
            mask: 0xfe00,
            value: 0x5200,
            mnemonic: 'strh',
            rm: 0x1c0,
            rn: 0x038,
            rd: 0x007,
            imm: 0
        },
        {
            // Store byte (Register offset)
            mask: 0xfe00,
            value: 0x5400,
            mnemonic: 'strb',
            rm: 0x1c0,
            rn: 0x038,
            rd: 0x007,
            imm: 0
        },
        {
            // Load signed byte (Register offset)
            mask: 0xfe00,
            value: 0x5600,
            mnemonic: 'ldrsb',
            rm: 0x1c0,
            rn: 0x038,
            rd: 0x007,
            imm: 0
        },
        {
            // Load word (Register offset)
            mask: 0xfe00,
            value: 0x5800,
            mnemonic: 'ldr',
            rm: 0x1c0,
            rn: 0x038,
            rd: 0x007,
            imm: 0
        },
        {
            // Load halfword (Register offset)
            mask: 0xfe00,
            value: 0x5a00,
            mnemonic: 'ldrh',
            rm: 0x1c0,
            rn: 0x038,
            rd: 0x007,
            imm: 0
        },
        {
            // Load byte (Register offset)
            mask: 0xfe00,
            value: 0x5c00,
            mnemonic: 'ldrb',
            rm: 0x1c0,
            rn: 0x038,
            rd: 0x007,
            imm: 0
        },
        {
            // Load signed halfword (Register offset)
            mask: 0xfe00,
            value: 0x5e00,
            mnemonic: 'ldrsh',
            rm: 0x1c0,
            rn: 0x038,
            rd: 0x007,
            imm: 0
        },
        {
            mask: 0xf800,
            value: 0x0000,
            mnemonic: 'lsl',
            rm: 0x38,
            rn: 0,
            rd: 0x03,
            imm: 0x7c
        },
        {
            mask: 0xf800,
            value: 0x0800,
            mnemonic: 'lsr',
            rm: 0x38,
            rn: 0,
            rd: 0x03,
            imm: 0x7c
        },
        {
            // Arithmetic shift right
            mask: 0xf800,
            value: 0x1000,
            mnemonic: 'asr',
            rm: 0x38,
            rn: 0,
            rd: 0x03,
            imm: 0x7c
        },
        {
            // Move immediate
            mask: 0xf800,
            value: 0x2000,
            mnemonic: 'mov',
            rm: 0,
            rn: 0x700,
            rd: 0x700,
            imm: 0xff
        },
        {
            // Compare immediate
            mask: 0xf800,
            value: 0x2800,
            mnemonic: 'cmp',
            rm: 0,
            rn: 0x700,
            rd: 0x700,
            imm: 0xff
        },
        {
            // Add immediate
            mask: 0xf800,
            value: 0x3000,
            mnemonic: 'add',
            rm: 0,
            rn: 0x700,
            rd: 0x700,
            imm: 0xff
        },
        {
            // Subtract immediate
            mask: 0xf800,
            value: 0x3800,
            mnemonic: 'sub',
            rm: 0,
            rn: 0x700,
            rd: 0x700,
            imm: 0xff
        },
        {
            // Load from literal pool
            mask: 0xf800,
            value: 0x4800,
            mnemonic: 'ldr',
            rm: 0,
            rn: 0,
            rd: 0x700,
            imm: 0xff
        },
        {
            // Load word immediate offset
            mask: 0xf800,
            value: 0x6000,
            mnemonic: 'ldr',
            rm: 0,
            rn: 0x38,
            rd: 0x07,
            imm: 0x7c0
        },
        {
            // Store word immediate offset
            mask: 0xf800,
            value: 0x6800,
            mnemonic: 'str',
            rm: 0,
            rn: 0x38,
            rd: 0x07,
            imm: 0x7c0
        },
        {
            // Load byte immediate offset
            mask: 0xf800,
            value: 0x7000,
            mnemonic: 'ldrb',
            rm: 0,
            rn: 0x38,
            rd: 0x07,
            imm: 0x7c0
        },
        {
            // Store byte immediate offset
            mask: 0xf800,
            value: 0x7800,
            mnemonic: 'strb',
            rm: 0,
            rn: 0x38,
            rd: 0x07,
            imm: 0x7c0
        },
        {
            // Load halfword immediate offset
            mask: 0xf800,
            value: 0x8000,
            mnemonic: 'ldrh',
            rm: 0,
            rn: 0x38,
            rd: 0x07,
            imm: 0x7c0
        },
        {
            // Store halfword immediate offset
            mask: 0xf800,
            value: 0x8800,
            mnemonic: 'strh',
            rm: 0,
            rn: 0x38,
            rd: 0x07,
            imm: 0x7c0
        },
        {
            description: 'Load word from stack offset',
            mask: 0xf800,
            value: 0x9000,
            mnemonic: 'ldr',
            rm: 0,
            rn: 0,
            rd: 0x700,
            imm: 0xff
        },
        {
            description: 'Store word to stack offset',
            mask: 0xf800,
            value: 0x9800,
            mnemonic: 'str',
            rm: 0,
            rn: 0,
            rd: 0x700,
            imm: 0xff
        },
        {
            description: 'Add immediate to PC',
            mask: 0xf800,
            value: 0xa000,
            mnemonic: 'add',
            rm: 0,
            rn: 0,
            rd: 0x700,
            imm: 0xff
        },
        {
            description: 'Add immediate to SP',
            mask: 0xf800,
            value: 0xa800,
            mnemonic: 'add',
            rm: 0,
            rn: 0,
            rd: 0x700,
            imm: 0xff
        },
        {
            description: 'Load multiple',
            mask: 0xf800,
            value: 0xc000,
            mnemonic: 'ldmia',
            rm: 0,
            rn: 0x700,
            rd: 0,
            imm: 0xff
        },
        {
            description: 'Load multiple',
            mask: 0xf800,
            value: 0xc800,
            mnemonic: 'stmia',
            rm: 0,
            rn: 0x700,
            rd: 0,
            imm: 0xff
        },
        {
            description: 'Unconditional branch',
            mask: 0xf800,
            value: 0xe000,
            mnemonic: 'b',
            rm: 0,
            rn: 0,
            rd: 0,
            imm: 0x7ff
        },
        {
            description: '32-bit instruction',
            mask: 0xf800,
            value: 0xe800,
            mnemonic: '32-bit',
            rm: 0,
            rn: 0,
            rd: 0,
            imm: 0
        },
        {
            description: '32-bit instruction',
            mask: 0xf000,
            value: 0xf000,
            mnemonic: '32-bit',
            rm: 0,
            rn: 0,
            rd: 0,
            imm: 0
        }
    ],
    instructionDecode: function(opcode) {
        
    },

    print: function () {
        console.log('CPU state:');
        for (var i = 0; i <= 12; i += 2) {
            console.log('    r' + i + ': 0x' + this['r' + i].toString(16) +
                        '    r' + i + ': 0x' + this['r' + i].toString(16));
        }
        console.log('    sp: 0x' + this.load('sp').toString(16));
        console.log('    lr: 0x' + this.load('lr').toString(16));
        console.log('    pc: 0x' + this.load('pc').toString(16));
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
            // SVC - 0b1101 1111 mmmm mmmm
            //   m : 8-bit immediate
            if ((inst & 0xff00) === 0xdf00) {
                var svc = inst & 0xff;
                console.log('svc #' + svc);
                if (typeof(this.svc[svc]) !== 'function') {
                    throw new Error('No SVC handler for svc #' + svc);
                }
                this.svc[svc](this);
            }
            else if ((inst & 0xff00) == 0xde00) {}
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