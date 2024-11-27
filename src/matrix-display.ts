import { TextParser } from './text-parser';
import { Cell, Color, Tile, TileId, Viewport } from './types';

interface PerformanceMetrics {
    lastRenderTime: number;
    averageRenderTime: number;
    dirtyRectCount: number;
    dirtyRectPixels: number;
    totalRenderCalls: number;
    fps: number;
    lastFpsUpdate: number;
    frameCount: number;
}

export enum LogLevel {
    NONE = 0,
    ERROR = 1,
    WARN = 2,
    INFO = 3,
    DEBUG = 4,
    VERBOSE = 5
}

export interface MatrixDisplayConfig {
    elementId?: string;
    cellSize: number;
    worldWidth: number;
    worldHeight: number;
    viewportWidth: number;
    viewportHeight: number;
    defaultFont?: string;
    customFont?: string;
    logLevel?: LogLevel;
}

export interface StringConfig {
    text: string;
    options?: {
        zIndex?: number;
        backgroundColor?: string;
        textBackgroundColor?: string;
        fillBox?: boolean;
        padding?: number;
    };
}

export enum FillDirection {
    TOP,
    RIGHT,
    BOTTOM,
    LEFT
}

export class MatrixDisplay {
    private displayCanvas: HTMLCanvasElement;    // The canvas shown to the user
    private displayCtx: CanvasRenderingContext2D;
    private worldCanvas: HTMLCanvasElement;      // Full world buffer
    private worldCtx: CanvasRenderingContext2D;
    private cells: Cell[][];
    private viewport: Viewport;
    private cellSize: number;
    private dirtyRects: Set<string>; // Store "x,y" strings for dirty cells
    private metrics: PerformanceMetrics;

    private worldWidth: number;
    private worldHeight: number;
    private readonly scale: number;
    private tileMap: Map<TileId, Tile> = new Map();
    private tileIdCounter: number = 0;
    private autoRender: boolean = true;
    private logLevel: LogLevel;
    private textParser: TextParser;

    constructor(options: MatrixDisplayConfig) {
        this.logLevel = options.logLevel ?? LogLevel.WARN;
        
        this.log.info('Initializing MatrixDisplay with options:', options);
        
        // Calculate DPI scale first
        this.scale = window.devicePixelRatio || 1;
        
        // Initialize dimensions
        this.worldWidth = options.worldWidth;
        this.worldHeight = options.worldHeight;
        this.cellSize = options.cellSize;
        
        // Main display canvas
        if (!options.elementId) {
            this.log.error('elementId is required');
            throw new Error('elementId is required in MatrixDisplayConfig');
        }
        
        this.displayCanvas = document.getElementById(options.elementId) as HTMLCanvasElement;
        if (!this.displayCanvas) {
            this.log.error(`Canvas element not found: ${options.elementId}`);
            throw new Error(`Canvas element not found: ${options.elementId}`);
        }

        // Get display context first
        this.displayCtx = this.displayCanvas.getContext('2d')!;
        
        // Create buffer canvases and contexts
        this.worldCanvas = document.createElement('canvas');
        this.worldCtx = this.worldCanvas.getContext('2d')!;

        // Calculate pixel dimensions
        const displayWidth = options.viewportWidth * options.cellSize;
        const displayHeight = options.viewportHeight * options.cellSize;

        // Set dimensions for display and world canvases only
        [this.displayCanvas, this.worldCanvas].forEach(canvas => {
            canvas.style.width = `${displayWidth}px`;
            canvas.style.height = `${displayHeight}px`;
            canvas.width = displayWidth * this.scale;
            canvas.height = displayHeight * this.scale;
        });

        // Scale contexts for DPI
        [this.displayCtx, this.worldCtx].forEach(ctx => {
            ctx.scale(this.scale, this.scale);
        });

        // Set dimensions
        this.cellSize = options.cellSize * this.scale;
        
        // Display canvas is viewport size
        this.displayCanvas.width = options.viewportWidth * this.cellSize;
        this.displayCanvas.height = options.viewportHeight * this.cellSize;
        
        // World buffer is full world size
        this.worldCanvas.width = options.worldWidth * this.cellSize;
        this.worldCanvas.height = options.worldHeight * this.cellSize;
        
        // Set CSS size (logical pixels)
        this.displayCanvas.style.width = `${options.viewportWidth * options.cellSize}px`;
        this.displayCanvas.style.height = `${options.viewportHeight * options.cellSize}px`;

        // Disable smoothing on all contexts
        [this.displayCtx, this.worldCtx].forEach(ctx => {
            ctx.imageSmoothingEnabled = false;
            // @ts-ignore (textRendering might not be in types)
            ctx.textRendering = 'geometricPrecision';
        });

        // Initialize viewport
        this.viewport = {
            x: 0,
            y: 0,
            width: options.viewportWidth,
            height: options.viewportHeight
        };

        // Initialize cells
        this.cells = this.initializeCells(options.worldWidth, options.worldHeight);
        this.dirtyRects = new Set();

        this.worldWidth = options.worldWidth;
        this.worldHeight = options.worldHeight;

        // Set up font
        this.setupFont(options.defaultFont, options.customFont);

        // Initialize metrics with safe default values
        this.metrics = {
            lastRenderTime: 0,
            averageRenderTime: 0,
            dirtyRectCount: 0,
            dirtyRectPixels: 0,
            totalRenderCalls: 0,
            fps: 0,
            lastFpsUpdate: performance.now(),
            frameCount: 0
        };

        // Initialize parser with standard color map
        this.textParser = new TextParser({
            'r': '#FF0000FF',  // red
            'g': '#00FF00FF',  // green
            'b': '#0088FFFF',  // blue
            'y': '#FFFF00FF',  // yellow
            'm': '#FF00FFFF',  // magenta
            'w': '#FFFFFFFF',  // white
        });

        this.log.info('MatrixDisplay initialization complete');
    }

    private initializeCells(width: number, height: number): Cell[][] {
        const cells: Cell[][] = [];
        for (let y = 0; y < height; y++) {
            cells[y] = [];
            for (let x = 0; x < width; x++) {
                cells[y][x] = {
                    overlay: '#00000000',
                    tiles: [],
                    isDirty: true
                };
            }
        }
        return cells;
    }

    private setupFont(defaultFont?: string, customFont?: string) {
        const fontFamily = customFont || defaultFont || 'monospace';
        const fontSize = Math.floor(this.cellSize * 0.8);
        
        [this.displayCtx, this.worldCtx].forEach(ctx => {
            ctx.font = `normal normal ${fontSize}px ${fontFamily}`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fontKerning = 'none';
            // @ts-ignore (textRendering might not be in types)
            ctx.textRendering = 'geometricPrecision';
        });
    }

    public createTile(
        x: number, 
        y: number, 
        char: string, 
        color: Color, 
        backgroundColor: Color, 
        zIndex: number = 1, 
        bgPercent: number = 1,
        fillDirection: FillDirection = FillDirection.BOTTOM
    ): TileId {
        const id = this.generateTileId();
        this.log.verbose(`Creating tile ${id} at (${x},${y})`);
        const tile: Tile = {
            id,
            x,
            y,
            char,
            color,
            backgroundColor,
            zIndex,
            bgPercent,
            fillDirection
        };
        
        this.tileMap.set(id, tile);
        this.setTileInCell(tile);
        this.renderIfAuto();
        
        return id;
    }

    public moveTile(tileId: TileId, newX: number, newY: number): void {
        const tile = this.tileMap.get(tileId);
        if (!tile) {
            this.log.warn(`Attempted to move non-existent tile: ${tileId}`);
            return;
        }

        // Add bounds checking
        if (newX < 0 || newX >= this.worldWidth || newY < 0 || newY >= this.worldHeight) {
            this.log.warn(`Attempted to move tile outside bounds: (${newX},${newY})`);
            return;
        }

        this.log.verbose(`Moving tile ${tileId} to (${newX},${newY})`);

        // Remove from old position
        const oldCell = this.cells[tile.y][tile.x];
        oldCell.tiles = oldCell.tiles.filter(t => t.id !== tileId);
        oldCell.isDirty = true;
        this.dirtyRects.add(`${tile.x},${tile.y}`);

        // Update position
        tile.x = newX;
        tile.y = newY;

        // Add to new position
        this.setTileInCell(tile);
        this.renderIfAuto();
    }

    public moveTiles(tileIds: TileId[], dx: number, dy: number): void {
        tileIds.forEach(tileId => {
            const tile = this.tileMap.get(tileId);
            if (tile) {
                this.moveTile(tileId, tile.x + dx, tile.y + dy);
            }
        });
    }

    public updateTile(tileId: TileId, updates: Partial<Omit<Tile, 'id'>>): void {
        const tile = this.tileMap.get(tileId);
        if (!tile) {
            this.log.warn(`Attempted to update non-existent tile: ${tileId}`);
            return;
        }
        this.log.verbose(`Updating tile ${tileId}`, updates);

        Object.assign(tile, updates);
        
        // If position changed, handle move
        if ('x' in updates || 'y' in updates) {
            this.moveTile(tileId, tile.x, tile.y);
        } else {
            // Just mark current position as dirty
            const cell = this.cells[tile.y][tile.x];
            cell.isDirty = true;
            this.dirtyRects.add(`${tile.x},${tile.y}`);
            this.renderIfAuto();
        }
    }

    public updateTiles(tileIds: TileId[], updates: Partial<Omit<Tile, 'id'>>): void {
        tileIds.forEach(tileId => this.updateTile(tileId, updates));
    }

    public removeTile(tileId: TileId): void {
        const tile = this.tileMap.get(tileId);
        if (!tile) {
            this.log.warn(`Attempted to remove non-existent tile: ${tileId}`);
            return;
        }
        this.log.verbose(`Removing tile ${tileId}`);

        // Remove from cell
        const cell = this.cells[tile.y][tile.x];
        cell.tiles = cell.tiles.filter(t => t.id !== tileId);
        cell.isDirty = true;
        this.dirtyRects.add(`${tile.x},${tile.y}`);

        // Remove from tile map
        this.tileMap.delete(tileId);
        this.renderIfAuto();
    }

    public removeTiles(tileIds: TileId[]): void {
        tileIds.forEach(tileId => this.removeTile(tileId));
    }

    private setTileInCell(tile: Tile): void {
        if (tile.x >= 0 && tile.x < this.worldWidth && 
            tile.y >= 0 && tile.y < this.worldHeight) {
            const cell = this.cells[tile.y][tile.x];
            
            // Insert maintaining z-order (higher z-index should be rendered later/on top)
            const insertIndex = cell.tiles.findIndex(t => t.zIndex > tile.zIndex);
            if (insertIndex === -1) {
                cell.tiles.push(tile);  // Add to end if highest z-index
            } else {
                cell.tiles.splice(insertIndex, 0, tile);  // Insert before higher z-index
            }
            
            cell.isDirty = true;
            this.dirtyRects.add(`${tile.x},${tile.y}`);
        }
    }

    public setOverlay(x: number, y: number, color: Color) {
        if (x < 0 || x >= this.worldWidth || y < 0 || y >= this.worldHeight) {
            this.log.warn(`Attempted to set overlay outside world bounds: (${x},${y})`);
            return;
        }

        this.cells[y][x].overlay = color;
        this.cells[y][x].isDirty = true;
        this.dirtyRects.add(`${x},${y}`);
        this.renderIfAuto();
    }

    public setViewport(x: number, y: number) {
        this.log.debug(`Setting viewport to (${x},${y})`);
                
        // Update viewport position
        this.viewport.x = Math.max(0, Math.min(x, this.worldCanvas.width / this.cellSize - this.viewport.width));
        this.viewport.y = Math.max(0, Math.min(y, this.worldCanvas.height / this.cellSize - this.viewport.height));

        // Mark all viewport cells as dirty since we need to redraw everything
        for (let vy = 0; vy < this.viewport.height; vy++) {
            for (let vx = 0; vx < this.viewport.width; vx++) {
                const worldX = vx + this.viewport.x;
                const worldY = vy + this.viewport.y;
                this.dirtyRects.add(`${worldX},${worldY}`);
            }
        }

        // Force immediate render since viewport changed
        this.renderIfAuto();
    }

    private renderCell(cell: Cell, x: number, y: number): void {
        const pixelX = x * this.cellSize/2;
        const pixelY = y * this.cellSize;
        
        this.worldCtx.save();
        
        // Create clipping path
        this.worldCtx.beginPath();
        this.worldCtx.rect(pixelX, pixelY, this.cellSize, this.cellSize);
        this.worldCtx.clip();
        
        // Clear and draw the cell's background first
        this.worldCtx.clearRect(pixelX, pixelY, this.cellSize/2, this.cellSize);
        
        // Sort tiles by z-index
        const sortedTiles = Array.from(cell.tiles.values()).sort((a, b) => a.zIndex - b.zIndex);

        sortedTiles.forEach(tile => {
            // Draw background if it has one
            if (tile.backgroundColor && tile.backgroundColor !== '#00000000') {
                const bgPercent = tile.bgPercent ?? 1;  // Default to 1 if not specified
                if (bgPercent > 0) {
                    this.worldCtx.fillStyle = tile.backgroundColor;
                    const cellWidth = this.cellSize/2;
                    const cellHeight = this.cellSize;

                    switch (tile.fillDirection) {
                        case FillDirection.TOP:
                            this.worldCtx.fillRect(
                                pixelX,
                                pixelY,
                                cellWidth,
                                cellHeight * bgPercent
                            );
                            break;
                        case FillDirection.RIGHT:
                            this.worldCtx.fillRect(
                                pixelX + cellWidth * (1 - bgPercent),
                                pixelY,
                                cellWidth * bgPercent,
                                cellHeight
                            );
                            break;
                        case FillDirection.BOTTOM:
                            this.worldCtx.fillRect(
                                pixelX,
                                pixelY + cellHeight * (1 - bgPercent),
                                cellWidth,
                                cellHeight * bgPercent
                            );
                            break;
                        case FillDirection.LEFT:
                            this.worldCtx.fillRect(
                                pixelX,
                                pixelY,
                                cellWidth * bgPercent,
                                cellHeight
                            );
                            break;
                    }
                }
            }
            
            if (tile.char && tile.color) {
                this.worldCtx.fillStyle = tile.color;
                this.worldCtx.font = `${Math.floor(this.cellSize * 0.8)}px monospace`;
                this.worldCtx.textAlign = 'center';
                this.worldCtx.textBaseline = 'bottom';
                const bottomPadding = Math.floor(this.cellSize * 0.05);
                this.worldCtx.fillText(
                    tile.char,
                    pixelX + this.cellSize/4,
                    pixelY + this.cellSize - bottomPadding
                );
            }
        });

        // Draw overlay on top of everything
        if (cell.overlay && cell.overlay !== '#00000000') {
            this.worldCtx.fillStyle = cell.overlay;
            this.worldCtx.fillRect(pixelX, pixelY, this.cellSize/2, this.cellSize);
        }
        
        this.worldCtx.restore();
    }

    public render(): void {
        const renderStart = performance.now();
        this.log.verbose('Starting render, dirty rects:', this.dirtyRects.size);

        if (this.dirtyRects.size === 0) {
            this.log.debug('No dirty rects, skipping render');
            this.updateMetrics(renderStart);
            return;
        }

        this.metrics.dirtyRectCount = this.dirtyRects.size;
        
        // Calculate bounds
        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;
        
        for (const key of this.dirtyRects) {
            const [x, y] = key.split(',').map(Number);
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x + 1);
            maxY = Math.max(maxY, y + 1);
        }

        this.log.debug(`Dirty rect bounds: (${minX},${minY}) to (${maxX},${maxY})`);

        // Render dirty cells
        for (const key of this.dirtyRects) {
            const [x, y] = key.split(',').map(Number);
            this.renderCell(this.cells[y][x], x, y);
        }
        this.log.verbose('Rendered dirty cells');
        this.dirtyRects.clear();

        this.log.debug('Copying to display canvas');
        // Copy to display
        const srcX = this.viewport.x * this.cellSize/2;
        const srcY = this.viewport.y * this.cellSize;
        const srcWidth = this.viewport.width * this.cellSize/2;
        const srcHeight = this.viewport.height * this.cellSize;

        // Clear the display canvas
        this.displayCtx.clearRect(0, 0, this.displayCanvas.width, this.displayCanvas.height);

        // Copy from world buffer to display canvas
        this.displayCtx.drawImage(
            this.worldCanvas,
            srcX, srcY, srcWidth, srcHeight,  // Source rectangle
            0, 0, srcWidth, srcHeight         // Destination rectangle
        );

        this.updateMetrics(renderStart);
    }

    private updateMetrics(renderStart: number) {
        const renderTime = performance.now() - renderStart;
        this.metrics.lastRenderTime = renderTime;
        
        // Update average render time
        if (this.metrics.totalRenderCalls === 0) {
            this.metrics.averageRenderTime = renderTime;
        } else {
            this.metrics.averageRenderTime = (
                (this.metrics.averageRenderTime * this.metrics.totalRenderCalls + renderTime) / 
                (this.metrics.totalRenderCalls + 1)
            );
        }
        
        this.metrics.totalRenderCalls++;
        this.metrics.frameCount++;

        // Update FPS every second
        const now = performance.now();
        const timeSinceLastUpdate = now - this.metrics.lastFpsUpdate;
        if (timeSinceLastUpdate >= 1000) {
            this.metrics.fps = (this.metrics.frameCount / timeSinceLastUpdate) * 1000;
            this.metrics.frameCount = 0;
            this.metrics.lastFpsUpdate = now;
        }
    }

    public getPerformanceMetrics(): Readonly<PerformanceMetrics> {
        return { ...this.metrics };
    }

    public getDebugString(): string {
        return `FPS: ${this.metrics.fps.toFixed(1)}
Render Time: ${this.metrics.lastRenderTime.toFixed(2)}ms (avg: ${this.metrics.averageRenderTime.toFixed(2)}ms)
Dirty Rects: ${this.metrics.dirtyRectCount}
Affected Pixels: ${this.metrics.dirtyRectPixels.toLocaleString()}`;
    }

    public clear() {
        this.log.info('Clearing display');
        
        // Clear all cells back to default state
        for (let y = 0; y < this.cells.length; y++) {
            for (let x = 0; x < this.cells[y].length; x++) {
                this.cells[y][x] = {
                    overlay: '#00000000',
                    tiles: [],
                    isDirty: true
                };
                this.dirtyRects.add(`${x},${y}`);
            }
        }

        // Clear all canvases
        this.displayCtx.clearRect(0, 0, this.displayCanvas.width, this.displayCanvas.height);
        this.worldCtx.clearRect(0, 0, this.worldCanvas.width, this.worldCanvas.height);

        // Render the cleared state
        this.renderIfAuto();
    }

    public setTiles(x: number, y: number, tiles: Tile[]) {
        this.cells[y][x].tiles = tiles;
        this.cells[y][x].isDirty = true;
        this.dirtyRects.add(`${x},${y}`);
    }

    public clearOverlays() {
        this.log.debug('Clearing all overlays');
        for (let y = 0; y < this.cells.length; y++) {
            for (let x = 0; x < this.cells[y].length; x++) {
                this.cells[y][x].overlay = '#00000000';
                this.cells[y][x].isDirty = true;
                this.dirtyRects.add(`${x},${y}`);
            }
        }
        this.renderIfAuto();
    }

    public setBackground(symbol: string, fgColor: Color, bgColor: Color): void {
        // Set background for all cells
        for (let y = 0; y < this.worldHeight; y++) {
            for (let x = 0; x < this.worldWidth; x++) {
                // Create a background tile with z-index -1
                const backgroundTile: Tile = {
                    id: this.generateTileId(),
                    x: x,
                    y: y,
                    char: symbol,
                    color: fgColor,
                    backgroundColor: bgColor,
                    zIndex: -1,
                    bgPercent: 1,
                    fillDirection: FillDirection.BOTTOM
                };

                // Remove any existing tiles with z-index -1
                this.cells[y][x].tiles = this.cells[y][x].tiles.filter(t => t.zIndex !== -1);
                
                // Add the new background tile
                this.cells[y][x].tiles.push(backgroundTile);
                this.cells[y][x].isDirty = true;
                this.dirtyRects.add(`${x},${y}`);
            }
        }
        this.renderIfAuto();
    }

    public getWorldWidth(): number {
        return this.worldWidth;
    }

    public getWorldHeight(): number {
        return this.worldHeight;
    }

    public getViewportWidth(): number {
        return this.viewport.width;
    }

    public getViewportHeight(): number {
        return this.viewport.height;
    }

    private generateTileId(): TileId {
        // Format: t_[timestamp]_[counter]
        const timestamp = Date.now();
        const id = `t_${timestamp}_${this.tileIdCounter++}`;
        return id;
    }

    public getTile(tileId: TileId): Tile | undefined {
        return this.tileMap.get(tileId);
    }

    public setAutoRender(enabled: boolean): void {
        this.autoRender = enabled;
    }

    private renderIfAuto(): void {
        if (this.autoRender) {
            this.render();
        }
    }

    public setLogLevel(level: LogLevel): void {
        this.log.info(`Changing log level from ${LogLevel[this.logLevel]} to ${LogLevel[level]}`);
        this.logLevel = level;
    }

    private log = {
        error: (...args: any[]) => {
            if (this.logLevel >= LogLevel.ERROR) console.error('[MatrixDisplay]', ...args);
        },
        warn: (...args: any[]) => {
            if (this.logLevel >= LogLevel.WARN) console.warn('[MatrixDisplay]', ...args);
        },
        info: (...args: any[]) => {
            if (this.logLevel >= LogLevel.INFO) console.log('[MatrixDisplay]', ...args);
        },
        debug: (...args: any[]) => {
            if (this.logLevel >= LogLevel.DEBUG) console.log('[MatrixDisplay][Debug]', ...args);
        },
        verbose: (...args: any[]) => {
            if (this.logLevel >= LogLevel.VERBOSE) console.log('[MatrixDisplay][Verbose]', ...args);
        }
    };

    public createString(
        x: number,
        y: number,
        text: string,
        zIndex: number = 1
    ): TileId[] {
        const segments = this.textParser.parse(text);
        const tileIds: TileId[] = [];
        let currentX = x;

        segments.forEach(segment => {
            Array.from(segment.text).forEach(char => {
                const tileId = this.createTile(
                    currentX++,
                    y,
                    char,
                    segment.color,
                    "#000000FF",  // Default background
                    zIndex,
                    1,  // Default bgPercent
                    FillDirection.BOTTOM  // Default fillDirection
                );
                tileIds.push(tileId);
            });
        });

        return tileIds;
    }

    public createWrappedString(
        x: number,
        y: number,
        width: number,
        height: number,
        text: string,
        options: {
            zIndex?: number;
            backgroundColor?: string;
            textBackgroundColor?: string;
            fillBox?: boolean;
            padding?: number;
        } = {}
    ): TileId[] {
        const {
            zIndex = 1,
            backgroundColor = '#00000000',
            textBackgroundColor = '#00000000',
            fillBox = false,
            padding = 0
        } = options;

        const tileIds: TileId[] = [];
        
        // Adjust dimensions and position for padding
        const actualX = x - padding;
        const actualY = y - padding;
        const actualWidth = width + (padding * 2);
        const actualHeight = height + (padding * 2) + 1;  // Add 1 for bottom padding

        // Create background if requested
        if (fillBox) {
            for (let py = actualY; py < actualY + actualHeight; py++) {
                for (let px = actualX; px < actualX + actualWidth; px++) {
                    const tileId = this.createTile(
                        px,
                        py,
                        ' ',  // Empty space for background
                        '#00000000',  // Transparent foreground
                        backgroundColor,
                        zIndex - 1,  // Place background behind text
                        1,  // Full background
                        FillDirection.BOTTOM
                    );
                    tileIds.push(tileId);
                }
            }
        }

        // Create text tiles (original wrapping logic)
        const segments = this.textParser.parse(text);
        let currentX = x;
        let currentY = y;
        let lineStart = x;
        let currentLineWords: { tileIds: TileId[]; text: string; }[] = [];

        segments.forEach(segment => {
            const words = segment.text.split(/(\s+)/);
            
            words.forEach(word => {
                if (!word.length) return;

                const wordTileIds: TileId[] = [];
                Array.from(word).forEach(char => {
                    const tileId = this.createTile(
                        currentX + wordTileIds.length,
                        currentY,
                        char,
                        segment.color,
                        textBackgroundColor,
                        zIndex,
                        1,  // Full background
                        FillDirection.BOTTOM
                    );
                    wordTileIds.push(tileId);
                });

                // Check if adding this word would exceed the width
                if (currentX - lineStart + word.length > width && currentLineWords.length > 0) {
                    // Move to next line
                    currentY++;
                    currentX = x;
                    lineStart = x;

                    // Reset line tracking
                    currentLineWords = [];
                }

                // Move word to current position
                wordTileIds.forEach((tileId, i) => {
                    this.moveTile(tileId, currentX + i, currentY);
                });

                // Add to tracking
                currentLineWords.push({ tileIds: wordTileIds, text: word });
                tileIds.push(...wordTileIds);

                // Update position for next word
                currentX += word.length;
            });
        });
        
        return tileIds;
    }

    public emptyCell(x: number, y: number): void {
        if (x < 0 || x >= this.worldWidth || y < 0 || y >= this.worldHeight) {
            this.log.warn(`Attempted to empty cell outside world bounds: (${x},${y})`);
            return;
        }

        // Get all tile IDs in this cell and remove them
        const cell = this.cells[y][x];
        const tileIds = cell.tiles.map(t => t.id);
        tileIds.forEach(id => this.removeTile(id));
    }
} 