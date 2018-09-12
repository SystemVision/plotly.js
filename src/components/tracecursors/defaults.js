'use strict';

var Lib = require('../../lib');
var Axes = require('../../plots/cartesian/axes');
var handleArrayContainerDefaults = require('../../plots/array_container_defaults');
var isNumeric = require('fast-isnumeric');

var attributes = require('./attributes');


module.exports = function supplyLayoutDefaults(layoutIn, layoutOut) {
    var opts = {
        name: 'tracecursors',
        handleItemDefaults: handleCursorDefaults
    };

    handleArrayContainerDefaults(layoutIn, layoutOut, opts);
};

function handleCursorDefaults(tracecursorIn, tracecursorOut, fullLayout) {
    // opts = opts || {};
    // itemOpts = itemOpts || {};

    function coerce(attr, dflt) {
        return Lib.coerce(tracecursorIn, tracecursorOut, attributes, attr, dflt);
    }

    coerce('layer', 'above');
    coerce('type', 'line');
    coerce('cursorMode');

    coerce('line.color');
    coerce('line.width');

    var dfltDash = tracecursorIn.cursorMode === 'frozen' ? 'dash' : 'solid';
    coerce('line.dash', dfltDash);

    var gdMock;
    // positioning
    gdMock = {_fullLayout: fullLayout};

    // xref
    Axes.coerceRef(tracecursorIn, tracecursorOut, gdMock, 'x', '', '');

    var ax;
    var axRef = tracecursorOut.xref;

    ax = Axes.getFromId(gdMock, axRef);

    var rangeNow = [
        ax.r2l(ax.range[0]),
        ax.r2l(ax.range[1]),
    ];

    // Set default as amiddle of the range
    var xDflt = (rangeNow[0] + rangeNow[1]) / 2.0;

    // And specails default value for dates
    if(ax.type === 'date' && ax.calendar) {
        xDflt = ax.c2d(xDflt, 0, ax.calendar);
    }

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
            //     in0 = tracecursorIn[attr0],
            //     in1 = tracecursorIn[attr1];
            // tracecursorIn[attr0] = pos2r(tracecursorIn[attr0], true);
            // tracecursorIn[attr1] = pos2r(tracecursorIn[attr1], true);

            // // x0, x1 (and y0, y1)
            // Axes.coercePosition(tracecursorOut, gdMock, coerce, axRef, attr0, dflt0);
            // Axes.coercePosition(tracecursorOut, gdMock, coerce, axRef, attr1, dflt1);

            // // hack part 2
            // tracecursorOut[attr0] = r2pos(tracecursorOut[attr0]);
            // tracecursorOut[attr1] = r2pos(tracecursorOut[attr1]);
            // tracecursorIn[attr0] = in0;
            // tracecursorIn[attr1] = in1;

    coerce('x', xDflt);

    // x value still can be incorrect
    // For example, if we use "aaa" as x value for "date" x axis

    var xx = tracecursorOut.x;

    if(ax.type === 'date') {
        if(!Lib.isDateTime(xx, ax.calendar)) {
            tracecursorOut.x = xDflt;
        }
    } else {
        if(!isNumeric(tracecursorOut.x)) {
            tracecursorOut.x = xDflt;
        }
    }

    return tracecursorOut;
}
