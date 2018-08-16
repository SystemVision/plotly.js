'use strict';

var Lib = require('../../lib');
var Axes = require('../../plots/cartesian/axes');
var handleArrayContainerDefaults = require('../../plots/array_container_defaults');

var attributes = require('./attributes');


module.exports = function supplyLayoutDefaults(layoutIn, layoutOut) {
    var opts = {
        name: 'svcursors',
        handleItemDefaults: handleCursorDefaults
    };

    handleArrayContainerDefaults(layoutIn, layoutOut, opts);
};

function handleCursorDefaults(svcursorIn, svcursorOut, fullLayout) {
    // opts = opts || {};
    // itemOpts = itemOpts || {};

    function coerce(attr, dflt) {
        return Lib.coerce(svcursorIn, svcursorOut, attributes, attr, dflt);
    }

    coerce('layer', 'above');
    coerce('type', 'line');
    coerce('cursorMode');

    coerce('line.color');
    coerce('line.width');

    var dfltDash = svcursorIn.cursorMode === 'frozen' ? 'dash' : 'solid';
    coerce('line.dash', dfltDash);

    // positioning
    var axLetters = ['x', 'y'];
    for(var i = 0; i < 2; i++) {
        var axLetter = axLetters[i],
            gdMock = {_fullLayout: fullLayout};

        // xref, yref
        Axes.coerceRef(svcursorIn, svcursorOut, gdMock, axLetter, '', 'paper');

        // var ax, pos2r;

        // if(axRef !== 'paper') {
        //     ax = Axes.getFromId(gdMock, axRef);
        //     //r2pos = helpers.rangeToShapePosition(ax);
        //     pos2r = helpers.shapePositionToRange(ax);
        // }
        // else {
        //     pos2r = r2pos = Lib.identity;
        // }

            // // hack until V2.0 when log has regular range behavior - make it look like other
            // // ranges to send to coerce, then put it back after
            // // this is all to give reasonable default position behavior on log axes, which is
            // // a pretty unimportant edge case so we could just ignore this.
            // var attr0 = axLetter + '0',
            //     attr1 = axLetter + '1',
            //     in0 = svcursorIn[attr0],
            //     in1 = svcursorIn[attr1];
            // svcursorIn[attr0] = pos2r(svcursorIn[attr0], true);
            // svcursorIn[attr1] = pos2r(svcursorIn[attr1], true);

            // // x0, x1 (and y0, y1)
            // Axes.coercePosition(svcursorOut, gdMock, coerce, axRef, attr0, dflt0);
            // Axes.coercePosition(svcursorOut, gdMock, coerce, axRef, attr1, dflt1);

            // // hack part 2
            // svcursorOut[attr0] = r2pos(svcursorOut[attr0]);
            // svcursorOut[attr1] = r2pos(svcursorOut[attr1]);
            // svcursorIn[attr0] = in0;
            // svcursorIn[attr1] = in1;

    }

    coerce('x');

    return svcursorOut;
}
