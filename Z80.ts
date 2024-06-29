import MMU from "./mmu";
import GPU from "./gpu";
/*
f = flags register
Flags:
  - Zero (0x80) Last operation resulted in 0
  - Operation (0x40) Last operation was substraction
  - Half-carry (0x20) Lower half of the byte overflowed past 15
  - Carry (0x10) Last operation resulted in over 255 for additions or below 0 for substractions.

*/
type CPU = {
  _clock: {
    m: number;
    t: number;
  }
  _r: {
    a: number; b: number; c: number; d: number; e: number; h: number; l:number; f:number;
    pc: number; sp: number; m: number; t: number;
  }
  _halt: number;
  _ops: any;
  reset: () => void;
  exec: () => void;
  _map: any[];
}
const Z80: CPU = {
  _map: [],
  _clock: { m:0, t: 0 },
  _r: {
    a:0, b:0, c:0, d:0, e:0, h:0, l:0, f:0, //8-bit registers
    pc:0, sp:0, // 16-bit registers
    m: 0, t:0 //last Clock
  },
  _halt: 0,
  _ops: {
  NOP: function() { Z80._r.m = 1; Z80._r.t = 4; },
  // *== load instructions ==*
  LDAmm: function() { let addr = MMU.rw(Z80._r.pc); Z80._r.pc += 2; Z80._r.a = MMU.rb(addr); Z80._r.m = 4; Z80._r.t = 16; },
  LDBmm: function() { let addr = MMU.rb(Z80._r.pc); Z80._r.pc += 2; Z80._r.b = MMU.rb(addr); Z80._r.m = 4; Z80._r.t = 16; },
  LDCmm: function(){ let addr = MMU.rw(Z80._r.pc); Z80._r.pc += 2; Z80._r.c = MMU.rb(addr); Z80._r.m = 4; Z80._r.t = 16; },
  LDEmm: function() { let addr = MMU.rw(Z80._r.pc); Z80._r.pc += 2; Z80._r.e = MMU.rb(addr); Z80._r.m = 4; Z80._r.t = 16; },
  LDBCnn: function() { Z80._r.c=MMU.rb(Z80._r.pc); Z80._r.b=MMU.rb(Z80._r.pc+1); Z80._r.pc+=2; Z80._r.m=3; },
  LDSPnn: function() { Z80._r.sp = MMU.rw(Z80._r.pc); Z80._r.pc += 2; Z80._r.m = 3; Z80._r.t = 12; },
  LDHLIA: function() { MMU.wb((Z80._r.h<<8)+Z80._r.l, Z80._r.a); Z80._r.l=(Z80._r.l+1)&255; if(!Z80._r.l) Z80._r.h=(Z80._r.h+1)&255; Z80._r.m=2; },
  LDABCm: function () { Z80._r.a=MMU.rb((Z80._r.b << 8)+Z80._r.c); Z80._r.m=2;  },
  LDmmHL: function() { const i = MMU.rw(Z80._r.pc); Z80._r.pc += 2; MMU.ww(i,(Z80._r.h<<8)+Z80._r.l); Z80._r.m = 5; },
  LDHLmr_a: function() { MMU.wb((Z80._r.h<<8)+Z80._r.l, Z80._r.a); Z80._r.m=2; },
  LDHLmr_b: function() { MMU.wb((Z80._r.h<<8)+Z80._r.l,Z80._r.b); console.log(`Writing value in reg B ${Z80._r.b} into address ${(Z80._r.h<<8)+Z80._r.l}`); },
  LDHLmn: function() { MMU.wb((Z80._r.h<<8)+Z80._r.l, MMU.rb(Z80._r.pc)); Z80._r.pc++; Z80._r.m=3; },
  LDHLnn: function() { Z80._r.h = MMU.rb(Z80._r.pc); Z80._r.l = MMU.rb(Z80._r.pc+1); console.log(`Load HL from PC and PC+1. H = ${Z80._r.h} L = ${Z80._r.l}`); Z80._r.pc += 2; Z80._r.m = 3; Z80._r.t = 12; },
  LDrn_d: function() { Z80._r.d=MMU.rb(Z80._r.pc); Z80._r.pc++; Z80._r.m=2; },
  LDrn_e: function() { Z80._r.e=MMU.rb(Z80._r.pc); Z80._r.pc++; Z80._r.m=2; },
  LDrr_ad: function() { Z80._r.a=Z80._r.d; Z80._r.m=1; },


  //*== increase instructions ==*
  INCr_e: function() { Z80._r.e++; Z80._r.e&=255; Z80._r.f=Z80._r.e?0:0x80; Z80._r.m=1; },
  INCBC: function() { Z80._r.c=(Z80._r.c+1)&255; if(!Z80._r.c) Z80._r.b=(Z80._r.b+1)&255; Z80._r.m=1; },
  INCHL: function() { Z80._r.l=(Z80._r.l+1)&255; if(!Z80._r.l) Z80._r.h=(Z80._r.h+1)&255; Z80._r.m=1 },
  INCHLm: function() { const i=(MMU.rb((Z80._r.h<<8)+Z80._r.l)+1)&255; MMU.wb((Z80._r.h<<8)+Z80._r.l,i); Z80._r.f=i?0:0x80; Z80._r.m=3; },
  DECr_d: function() { Z80._r.d--; Z80._r.d&=255; Z80._r.f=Z80._r.d?0:0x80; Z80._r.m=1; },

  ADDr_e: function() {
    console.log(`Add register E ${Z80._r.e} to register A ${Z80._r.a}`);
    Z80._r.a += Z80._r.e;
    Z80._r.f = 0;
    if(!(Z80._r.a & 255)) Z80._r.f |= 0x80;
    if(Z80._r.a > 255) Z80._r.f |= 0x10;
    Z80._r.m = 1; Z80._r.t = 4;
  },
  CPr_b: function() { let i = Z80._r.a; Z80._r.a -= Z80._r.b; Z80._r.f = 0x40; if(!(Z80._r.a & 255)) Z80._r.f |= 0x80; if(Z80._r.a > 0) Z80._r.f |= 0x10; },
  CPr_d: function() { var i=Z80._r.a; i-=Z80._r.d; Z80._r.f=(i<0)?0x50:0x40; i&=255; if(!i) Z80._r.f|=0x80; if((Z80._r.a^Z80._r.d^i)&0x10) Z80._r.f|=0x20; Z80._r.m=1; },
  CPr_e: function() { var i=Z80._r.a; i-=Z80._r.e; Z80._r.f=(i<0)?0x50:0x40; i&=255; if(!i) Z80._r.f|=0x80; if((Z80._r.a^Z80._r.e^i)&0x10) Z80._r.f|=0x20; Z80._r.m=1; },
  PUSHBC: function() {
    Z80._r.sp--;
    MMU.wb(Z80._r.sp, Z80._r.b);
    Z80._r.sp--;
    MMU.wb(Z80._r.sp, Z80._r.c);

    console.log(`PUSH reg B (value ${Z80._r.b}) and C (value ${Z80._r.c}) to STACK`);
    Z80._r.m = 3; Z80._r.t = 12;
  },
  POPHL: function() {
    Z80._r.l = MMU.rb(Z80._r.sp);
    Z80._r.sp++;
    Z80._r.h = MMU.rb(Z80._r.sp);
    Z80._r.sp++;
    Z80._r.m = 3; Z80._r.t = 12;
  },
    XOR_a: function() {
      Z80._r.a ^= Z80._r.a;
      Z80._r.a &= 255;
      Z80._r.f = Z80._r.a ? 0 : 0x80;
      console.log(`XOR Reg A on itself. Result: ${Z80._r.a} Flags: ${Z80._r.f}`);

      Z80._r.m = 1; Z80._r.t = 4;
    },
    JPnn: function() {
      let target = MMU.rw(Z80._r.pc++);
      console.log(`JUMP to address 0x${(target).toString(16).toUpperCase()}`);
      Z80._r.pc = target;
      Z80._r.m = 3; Z80._r.t = 12;
    },
    JPNZnn: function() { Z80._r.m=3; if((Z80._r.f&0x80)==0x00) { Z80._r.pc=MMU.rw(Z80._r.pc); Z80._r.m++; } else Z80._r.pc+=2; },
    HALT: function() {
      Z80._halt = 1;
      Z80._r.m = 1; Z80._r.t = 4;
      console.log('Set halt flag');
    }
  },
  reset: function() {
    Z80._r.a = 0; Z80._r.b = 0; Z80._r.c = 0; Z80._r.d = 0;
  	Z80._r.e = 0; Z80._r.h = 0; Z80._r.l = 0; Z80._r.f = 0;
	  Z80._r.sp = 0;
  	Z80._r.pc = 0;      // Start execution at 0
    Z80._halt = 0;

	  Z80._clock.m = 0; Z80._clock.t = 0;
  },
  exec: function() {
    let op = MMU.rb(Z80._r.pc++);
    console.log("Executing OPCODE", '0x'+(op).toString(16), Z80._map[op].name);
    Z80._map[op]();
    // Z80._r.pc &= 65537;
    Z80._clock.m += Z80._r.m;
    Z80._clock.t += Z80._r.t;

    GPU.step();
  },
}

function dispatcher() {
  while(!(Z80._halt)) {
    Z80.exec();
  }
}


Z80._map = [
  Z80._ops.NOP,     // 0x00 * correct place
  Z80._ops.LDBCnn,  // 0x01 * correct place
  Z80._ops.LDHLmr_b,// 0x02 legacy (replace when possible)
  Z80._ops.INCBC,   // 0x03 * correct place
  Z80._ops.LDAmm,   // 0x04
  Z80._ops.LDBmm,   // 0x05
  Z80._ops.LDCmm,   // 0x06
  Z80._ops.LDEmm,   // 0x07
  Z80._ops.LDSPnn,  // 0x08
  Z80._ops.ADDr_e,  // 0x09
  Z80._ops.LDABCm,  // 0x0A * correct place
  Z80._ops.PUSHBC,  // 0x0B
  Z80._ops.POPHL,   // 0x0C
  Z80._ops.XOR_a,   // 0x0D
  Z80._ops.LDmmHL,  // 0x0E
                    // 0x0F moved CPr_b to coreect address 0xB8
];

Z80._map[0x15] = Z80._ops.DECr_d;
Z80._map[0x16] = Z80._ops.LDrn_d; 
Z80._map[0x1C] = Z80._ops.INCr_e;
Z80._map[0x1E] = Z80._ops.LDrn_e;
Z80._map[0x21] = Z80._ops.LDHLnn;
Z80._map[0x22] = Z80._ops.LDHLIA;
Z80._map[0x23] = Z80._ops.INCHL;
Z80._map[0x34] = Z80._ops.INCHLm;
Z80._map[0x36] = Z80._ops.LDHLmn;
Z80._map[0x70] = Z80._ops.LDHLmr_b;
Z80._map[0x76] = Z80._ops.HALT;
Z80._map[0x77] = Z80._ops.LDHLmr_a;
Z80._map[0x7A] = Z80._ops.LDrr_ad;
Z80._map[0xB8] = Z80._ops.CPr_b; 
Z80._map[0xBA] = Z80._ops.CPr_d
Z80._map[0xBB] = Z80._ops.CPr_e;
Z80._map[0xC2] = Z80._ops.JPNZnn;
Z80._map[0xC3] = Z80._ops.JPnn;


export default Z80;
export { dispatcher };
