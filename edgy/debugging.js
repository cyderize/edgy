(function() {

/** Break points */

// Add break points to user menu
BlockMorph.prototype.userMenu = (function(oldUserMenu) {
    return function() {
        var menu = oldUserMenu.call(this);
        
        if (!this.isTemplate && // Template blocks can't have break points
            !(this instanceof HatBlockMorph) && // Events can't have break points
            !contains(['reportOr', 'reportAnd'], // And and Or aren't evaluated normally
                this.selector)) { 
            
            menu.addLine();
            
            if (this.breakPoint) {
                menu.addItem(
                    'disable breakpoint',
                    'disableBreakPoint'
                );
            }
            else {
                menu.addItem(
                    'enable breakpoint',
                    'enableBreakPoint'
                );
            }
        }

        return menu;
    };
}(BlockMorph.prototype.userMenu));

// Enable break point for this block
BlockMorph.prototype.enableBreakPoint = function() {
    this.breakPoint = true;
    this.breakPointMorph = new StringMorph(
        String.fromCharCode(9670),
        this.fontSize,
        null, // style (sans-serif)
        true // bold
    );
    this.fixLayout();
    this.fixLabelColor();
    this.drawNew();
    // Don't change the spec of a variable block
    if (this.selector != "reportGetVar") {
        this.oldSpec = this.blockSpec;
        this.blockSpec = String.fromCharCode(9670)+ " " + this.blockSpec;
    }
};

// Disable break point for this block
BlockMorph.prototype.disableBreakPoint = function() {
    this.breakPoint = false;
    this.breakPointMorph.destroy();
    this.fixLayout();
    this.drawNew();
    if (this.selector != "reportGetVar") {
        this.blockSpec = this.oldSpec;
    }
};

BlockMorph.prototype.fixLayout = (function(oldFixLayout) {
    return function() {
        if (this.breakPoint) {
            this.addBack(this.breakPointMorph);
        }
        oldFixLayout.call(this);
    };
}(BlockMorph.prototype.fixLayout));

// Change block evaluation to consider break points
Process.prototype.evaluateBlock = (function(oldEvaluateBlock) {
    return function(block, argCount) {
        var inputs = this.context.inputs;

        if (block.breakPoint && // This block has a break point enabled
            !this.context.doneBreakPoint && // Ensure breakpoint doesn't fire after unpausing
            inputs.length == argCount) { // The inputs have been evaluated
            
            this.handleBreakPoint(block, inputs);
            this.context.doneBreakPoint = true;
            this.doPauseAll();
            return;
        }

        return oldEvaluateBlock.call(this, block, argCount);
    }
}(Process.prototype.evaluateBlock));

// Show bubble of the inputs to a block
Process.prototype.handleBreakPoint = function(block, inputs) {
    var breakPointMorph = new AlignmentMorph('column');
    var text = new TextMorph("Breakpoint");
    
    breakPointMorph.add(text);
    inputs.forEach(function(input) {
        var morphToShow;
        if (input instanceof BlockMorph) {
            var img = input.fullImage();
            morphToShow = new Morph();
            morphToShow.silentSetWidth(img.width);
            morphToShow.silentSetHeight(img.height);
            morphToShow.image = img;
        }
        else {
            morphToShow = new CellMorph(input);
        }
        breakPointMorph.add(morphToShow);
    });
    
    var bubble = new SpeechBubbleMorph(
        breakPointMorph,
        null,
        Math.max(this.rounding - 2, 6),
        0
    );
    
    if (block.world()) {
        breakPointMorph.drawNew();
        breakPointMorph.fixLayout();
        
        var oldFixLayout = breakPointMorph.fixLayout;
        breakPointMorph.fixLayout = function() {
            oldFixLayout.call(this);
            bubble.fixLayout();
        };
        
        bubble.popUp(
            block.world(),
            block.rightCenter().add(new Point(2, 0)),
            true
        );
    }
    else {
        // The root of a custom block is not the world, so needs to be handled
        // slightly specially. Also attach an image of the block to help in
        // debugging.

        var img = block.fullImage();
        var morphToShow = new Morph();
        morphToShow.silentSetWidth(img.width);
        morphToShow.silentSetHeight(img.height);
        morphToShow.image = img;
        breakPointMorph.add(morphToShow);
        
        breakPointMorph.drawNew();
        breakPointMorph.fixLayout();
        
        bubble.popUp(
            this.topBlock.world(),
            this.topBlock.rightCenter().add(new Point(2, 0)),
            true
        );
    }
};

/** Text console tab */

// Add the tab
IDE_Morph.prototype.createSpriteBar = (function(oldCreateSpriteBar) {
    return function() {
        // Stop refresh temporarily since it ruins the order of tabs
        var oldRefresh = TabMorph.prototype.refresh;
        TabMorph.prototype.refresh = TabMorph.uber.refresh;
        
        oldCreateSpriteBar.call(this);
        
        // Reinstate refresh and let us do it ourselves
        TabMorph.prototype.refresh = oldRefresh;
        
        var myself = this,
            tabBar = this.spriteBar.tabBar,
            tabColors = this.tabColors,
            tabCorner = 15;

        var tab = new TabMorph(
            tabColors,
            null, // target
            function () { tabBar.tabTo('console'); },
            localize('Console'), // label
            function () {  // query
                return myself.currentTab === 'console';
            }
        );
        
        tab.padding = 3;
        tab.corner = tabCorner;
        tab.edge = 1;
        tab.labelShadowOffset = new Point(-1, -1);
        tab.labelShadowColor = tabColors[1];
        tab.labelColor = this.buttonLabelColor;
        tab.drawNew();
        tab.fixLayout();
        
        tabBar.add(tab);
        
        tabBar.fixLayout();
        tabBar.children.forEach(function (each) {
            each.refresh();
        });
    }
}(IDE_Morph.prototype.createSpriteBar));

// Populate the tab
IDE_Morph.prototype.createSpriteEditor = (function(oldCreateSpriteEditor) {
    return function() {
        if (this.spriteEditor) {
            this.spriteEditor.destroy();
        }
        
        if (this.currentTab === 'console') {
            this.spriteEditor = new ConsoleMorph(this.currentSprite, this.sliderColor, this.groupColor);
            this.add(this.spriteEditor);
            this.spriteEditor.fixLayout();
            this.spriteEditor.acceptDrops = false;
            return;
        }
        
        oldCreateSpriteEditor.call(this);
    };
}(IDE_Morph.prototype.createSpriteEditor));

var ConsoleMorph;

function ConsoleMorph(aSprite, sliderColor, color) {
    this.init(aSprite, sliderColor, color);
}

ConsoleMorph.prototype = new FrameMorph();
ConsoleMorph.prototype.constructor = ConsoleMorph;
ConsoleMorph.uber = FrameMorph.prototype;

ConsoleMorph.prototype.init = function(aSprite, sliderColor, color) {
    var myself = this;
    
    ConsoleMorph.uber.init.call(this, 0, 0);
    
    this.fps = 2;
    this.sprite = aSprite;
    this.sprite.text = this.sprite.text ? this.sprite.text : "";
    this.frame = new ScrollFrameMorph(null, null, sliderColor);
    this.frame.acceptDrops = false;
    this.frame.wantsDropOf = function() { return false; };
    this.frame.contents.acceptDrops = false;
    this.frame.contents.wantsDropOf = function() { return false; };
    this.frame.color = color;
    this.color = color;
    this.acceptDrops = false;
    
    this.textMorph = new TextMorph(this.sprite.text);
    this.textMorph.color = new Color(255, 255, 255);
    this.textMorph.drawNew();
    
    this.button = new PushButtonMorph(
        function() {
            myself.sprite.text = "";
            myself.drawNew();
        },
        null,
        "Clear console"
    );
    this.button.moveBy(new Point(3, 3));
    
    this.saveButton = new PushButtonMorph(
        function() {
            window.open(encodeURI("data:text/plain," + myself.sprite.text));
        },
        null,
        "Save console"
    );
    this.saveButton.setPosition(this.button.topRight().add(new Point(3, 0)));
    
    this.frame.contents.add(this.textMorph);
    
    this.add(this.button);
    this.add(this.saveButton);
    this.add(this.frame);
};

ConsoleMorph.prototype.drawNew = function() {
    ConsoleMorph.uber.drawNew.call(this);
    this.fixLayout();
    if (this.sprite) {
        this.sprite.text = this.sprite.text ? this.sprite.text : "";
        if (this.textMorph && this.textMorph.text != this.sprite.text) {
            this.textMorph.text = this.sprite.text;
            this.textMorph.drawNew();
        }
    }
    if (this.frame) {
        this.frame.drawNew();
    }
};

ConsoleMorph.prototype.fixLayout = function() {
    Morph.prototype.trackChanges = false;
    if (this.frame) {
        this.frame.setPosition(this.button.bottomLeft().add(new Point(0, 3)));
        this.frame.setExtent(this.extent().subtract(new Point(3, 3 + this.button.height())));
        this.frame.contents.adjustBounds();
    }
    this.adjustBounds();
    Morph.prototype.trackChanges = true;
    this.changed();
};

ConsoleMorph.prototype.wantsDropOf = function(morph) {
    return false;
};

SpriteMorph.prototype.printLineToConsole = function(string) {
    this.printToConsole(string + "\n");
};

SpriteMorph.prototype.printToConsole = function(string) {
    if (this.text) {
        this.text += string.toString();
    }
    else {
        this.text = string.toString();
    }
    var ide = this.parentThatIsA(IDE_Morph);
    if (ide && ide.spriteEditor instanceof ConsoleMorph) {
        ide.spriteEditor.drawNew();
    }
};

SpriteMorph.prototype.clearConsole = function() {
    this.text = "";
    var ide = this.parentThatIsA(IDE_Morph);
    if (ide && ide.spriteEditor instanceof ConsoleMorph) {
        ide.spriteEditor.drawNew();
    }
};

// Define new console blocks
var blocks = {
    printLineToConsole: {
        only: SpriteMorph,
        type: 'command',
        category: 'looks',
        spec: 'print line %s to console',
        defaults: [localize('Hello!')],
    },
    printToConsole: {
        only: SpriteMorph,
        type: 'command',
        category: 'looks',
        spec: 'print %s to console',
        defaults: [localize('Hello!')],
    },
    clearConsole: {
        only: SpriteMorph,
        type: 'command',
        category: 'looks',
        spec: 'clear console',
    }
};

// Add the new blocks.
for (var blockName in blocks) {
    if(blocks.hasOwnProperty(blockName)) {
        SpriteMorph.prototype.blocks[blockName] = blocks[blockName];
    }
}

SpriteMorph.prototype.blockTemplates = (function blockTemplates (oldBlockTemplates) {
    return function (category) {
        // block() was copied from objects.js
        function block(selector) {
            if (StageMorph.prototype.hiddenPrimitives[selector]) {
                return null;
            }
            var newBlock = SpriteMorph.prototype.blockForSelector(selector, true);
            newBlock.isTemplate = true;
            return newBlock;
        }

        var blocks = [];
        if (category === 'looks') {
            blocks = blocks.concat(oldBlockTemplates.call(this, category));
            blocks.push('-');
            blocks.push(block('printLineToConsole'));
            blocks.push(block('printToConsole'));
            blocks.push(block('clearConsole'));
            blocks.push('-');
        } else {
            return blocks.concat(oldBlockTemplates.call(this, category));
        }
        return blocks;
    };
}(SpriteMorph.prototype.blockTemplates));

})();
