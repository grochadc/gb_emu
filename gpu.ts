import Z80 from "./Z80";

type GPU = {
  _vram: number[];
  _oam: number[];
  _tileset: number[][][],
  _scrn: { data: number[], width: number; height: number; }
  _canvas: {
    putImageData: (scrn: any, arg1: number, arg2: number) => void;
  }
  reset: () => void;
  renderScan: () => void;
  updatetile: (addr: number, value: number) => void;
  _mode: number;
  _modeclock: number;
  _line: number;
  _scx: number;
  _scy: number;
  _bgmap: number;
  _palette : {
    bg: [number, number, number, number][];
  }
  _bgmapbase_addr: (0x1800 | 0x1C00);
  _bgtile: 0|1;
  step: () => void;
  wb: (addr: number, val: number) => void;
}
const GPU: GPU = {
    _bgtile:0,
    _vram: [0],
    // VRAM LAYOUT
    // VRAM[8000-87FF] tileset #1 tiles 0-127
    // VRAM[8800-8FFF] tileset #1 tiles 128-255, tileset #0 tiles -1 to -128
    // VRAM[9000-97FF] tileset #0 tiles 0-127
    // VRAM[9800-9BFF] tilemap #0
    // VRAM[9C00-9FFF] tilemap #1
    _oam: [0],
    _tileset: [[]],
    _scrn: { data: [], height:0, width:0 },
    _canvas: {
        putImageData: function(scrn) {
          console.log("Pushing screen to canvas.")
          console.log(scrn);
        }
      },

    reset: function() {
        for( let i=0; i<8192; i++ ) {
            GPU._vram[i] = 0;
        }
        for( let i=0; i<160; i++ ) {
            GPU._oam[i] = 0;
        }

        GPU._tileset = [];
        for ( let i=0; i<384; i++ ) {
            GPU._tileset[i] = [];
            for( let j=0; j<8; j++ ) {
                GPU._tileset[i][j] = [0,0,0,0,0,0,0,0]
            }
        }

        // for(let i=0;i<4;i++) {
        //  GPU._palette.bg[i] = 255;
        // }

        GPU._palette.bg = [[255, 255, 255, 255],[192, 192, 192, 255],[96, 96, 96, 255],[0, 0, 0, 255]];
        /*
        console.log("init canvas");
      let c = document.querySelector("#screen");
      if (c && c.getContext) {
        GPU._canvas = c.getContext('2d');
        if (GPU._canvas) {
          if(GPU._canvas.createImageData) GPU._scrn = GPU._canvas.createImageData(160, 144);
          else if (GPU._canvas.getImageData) GPU._scrn = GPU._canvas.getImageData(0, 0, 160, 144);
          else GPU._scrn = { 'width': 160, 'height': 144, 'data': new Array(160*144*4) };
          
          //initialize canvas to white
          for(let i=0; i< 160*44*4; i++ ) GPU._scrn.data[i] = 255;
        }
      }
        */
      GPU._scrn = {
        'width': 160,
        'height': 144,
        'data': new Array(160*144*4)
      };
       //initialize canvas to white
       for(let i=0; i< 160*44*4; i++ ) GPU._scrn.data[i] = 255;
    },
  
    updatetile: function(addr, value){
        let saddr = addr;
        // VRAM starts at 0x8000, odd AD  DR means its the second byte of the 16-bit word
        // N&1 returns 1 for odd numbers
        if(addr&1) { saddr--; } 
        // each tileline is updated 2 times, one for each byte needed for encoding color

        //which tile and row was updated
        let tile = (addr >> 4) & 511;
        let y = (addr >> 1) & 7; // y is never increased  

        let sx;
        for(let x=0; x<8; x++) {
          //find bit index for this pixel
          sx = 1 << (7-x);

          // update tile set
          GPU._tileset[tile][y][x] = ((GPU._vram[saddr] & sx) ? 1 : 0) + ((GPU._vram[saddr+1] & sx) ? 2 : 0);
        }
    },
  
    _mode: 0,
    _modeclock: 0,
    _line: 0,
    _scx: 0,
    _scy: 0,
    _bgmap: 0,
    _palette:{
      bg:[]
    },
    _bgmapbase_addr: 0x1800, // bgmap should start at VRAM[0x1800]
    renderScan: function() {
      // VRAM offset for the tile map
      const mapbase = GPU._bgmap ? 0x1C00 : GPU._bgmapbase_addr; 
      // _bgmap is the background map tileset read from ROM[0x1800-0x1BFF] (is it read from ROM?)
      // _bgmapbase_addr where the bgmap ends and screen tiles start in VRAM, 0x1800 (no map) or 0x1C00

      // which line of tiles to use in the map

      // which line of pixels to use in the tiles
      const y = (GPU._line + GPU._scy) & 7; 
      //  X & 7 loops around after 7 kinda like % 7 would
      // 7 & 7 == 7; 8 & 7 == 0;

      // where in the tileline to start (inc advances to the right [0->,0,2,3,1,0,0,0])
      let x = GPU._scx & 7;

      // which tile to start scanning with in the map line
      // lineoffs can't be higher than 31 (tilemap is 32 'lines')
      let lineoffs = (GPU._scx>>3)&31; 
      // shift right >> 3 returns tilenumber in which scx currently is
      // scx 0x00 to 0x07 returns tile 0, scx 0x08 to 0x0F returns tile 1 etc

      // Where to render on the canvas
	    let canvasoffs = GPU._line * 160 * 4;

      // mapbase+lineoffs = skips bgmap and tiles outside the screen scx
      // tile_id is first byte of tile info (before encoding/coloring)
      let tile_id = GPU._vram[mapbase+lineoffs]; // only 1 num is returned, maybe tile_id?
      // VRAM contains pairs of bytes to color a tile line VRAM = [0x07, 0x07, 0x08, 0x08]
      const tilerow = GPU._tileset[tile_id][y]; // eg. [0,1,2,2,3,0,0,0]

      // If the tile data set in use is #1, the
	    // indices are signed; calculate a real tile offset
	    if(GPU._bgtile == 1 && tile_id < 128) tile_id += 256;

      // read tile index from the background map
      let colour: [number, number, number, number]; // 4 numbers are required in Canvas API r,g,b,a

      for(let i=0;i<160;i++){
        const pixel_from_tile_gb_encoded = GPU._tileset[tile_id][y][x]; // gb_encoded = 0|1|2|3;
        colour = GPU._palette.bg[pixel_from_tile_gb_encoded];
        // palette has the array we need to push into canvas for 1 pixel
        // [r,g,b,a] there are 4 arrays matching the four colors in gbcolor 0,1,2,3,

        // Plot the pixel to canvas
	    GPU._scrn.data[canvasoffs+0] = colour[0];
	    GPU._scrn.data[canvasoffs+1] = colour[1];
	    GPU._scrn.data[canvasoffs+2] = colour[2];
	    GPU._scrn.data[canvasoffs+3] = colour[3];
	    canvasoffs += 4;

	    // When this tile ends, read another
	    x++;
	    if(x === 8) {
		      x = 0;
		      lineoffs = (lineoffs + 1) & 31;
		      tile_id = GPU._vram[mapbase+lineoffs];
          if(GPU._bgtile == 1 && tile_id < 128) tile_id += 256;
	      }
      }
    },
    step: function() {
      if(Z80) GPU._modeclock += Z80._r.t;
      console.log(`GPU step. Current modeclock ${GPU._modeclock}`);
  
      switch(GPU._mode) {
            // OAM read mode, scanline active
            case 2:
                if(GPU._modeclock >= 80) {
                  // Enter scanline mode 3
                  GPU._modeclock = 0;
                  GPU._mode = 3;
                }
            break;
            
            // VRAM read mode, scanline active
            // Treat end of mode 3 as end of scanline
            case 3:
            if(GPU._modeclock >= 172) {
              // Enter hblank
              GPU._modeclock = 0;
              GPU._mode = 0;
            
              // Write a scanline to the framebuffer
              GPU.renderScan();
            }
            break;
        // Hblank
        // After the last hblank, push the screen data to canvas
        case 0: 
          if(GPU._modeclock >= 204) {
            GPU._modeclock = 0;
            GPU._line++;
            if(GPU._line == 143) {
              // Enter vblank
              GPU._mode = 1;
              GPU._canvas.putImageData(GPU._scrn, 0, 0);
            } else {
              GPU._mode = 2;
            }
          }
        break;
  
        // vblank (10 lines)
        case 1:
          if(GPU._modeclock >= 456) {
            GPU._modeclock = 0;
            GPU._line++;
  
            if(GPU._line > 153) {
              // Restart scanning modes
              GPU._mode = 2;
              GPU._line = 0;
            }
          }
        break;
      }
    },
    wb: function(addr, val) {
      var gaddr = addr-0xFF40;
      switch(gaddr) {
        case 2: GPU._scy = val; break; // address 0xFF42
        case 3: GPU._scx = val; break; // address 0xFF43
        case 7:  // address 0xFF47
        // To set the 'correct' palette [3,2,1,0]|[0,96,192,255] put 0x1B in addr 0xFF47

          for(let i=0;i<4;i++){
            switch((val>>(i*2))&3){
              case 0: GPU._palette.bg[i] = [255, 255, 255,255]; break;
              case 1: GPU._palette.bg[i] = [192, 192, 192, 255]; break;
              case 2: GPU._palette.bg[i] = [96, 96, 96, 255]; break;
              case 3: GPU._palette.bg[i] = [0, 0, 0, 255]; break;
            }
          }
        break;
      }
    },
}

GPU.reset();

export default GPU;