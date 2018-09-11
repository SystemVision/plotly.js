/**
* Copyright 2012-2018, Plotly, Inc.
* All rights reserved.
*
* This source code is licensed under the MIT license found in the
* LICENSE file in the root directory of this source tree.
*/


'use strict';

var axisIds = require('../../plots/cartesian/axis_ids');

var Registry = require('../../registry');

var Lib = require('../../lib');

module.exports = {
    add: addTraceCursor,
    delete: delTraceCursor
};

/**
 * Tracecursors wrapper around 'add' and 'delete'.
 *
 * @param {object} gd main plot object
 *
 */

function addTraceCursor(gd) {
    // Get only "x" axes
    var axList = axisIds.list(gd, 'x', true);

    var rangeNow = [0, 1];

    var newTraceCursorsOut = [];// Lib.extendDeepAll({}, gd._fullLayout.tracecursors);


    for(var j = 0; j < gd._fullLayout.tracecursors.length; j++) {
        var cur = Lib.extendDeepAll({}, gd._fullLayout.tracecursors[j]);
        newTraceCursorsOut.push(cur);
    }

    for(var i = 0; i < axList.length; i++) {
        var ax = axList[i];
        // This is visible range
        rangeNow = [
            ax.r2l(ax.range[0]),
            ax.r2l(ax.range[1]),
        ];
        var xVal = (rangeNow[0] + rangeNow[1]) / 2.0;

        if(ax.type === 'date' && ax.calendar) {
            xVal = ax.c2d(xVal, 0, ax.calendar);
        }

        var newTraceCursorsIn = {
            x: xVal,
            xref: ax._id
        };

        newTraceCursorsOut.push(newTraceCursorsIn);
    }

    var update = {
        tracecursors: newTraceCursorsOut
    };

    Registry.call('relayout', gd, update);

}

function delTraceCursor(gd) {
    var update = [];

    var newTraceCursorsOut = [];


    for(var j = 0; j < gd._fullLayout.tracecursors.length; j++) {
        var cur = Lib.extendDeepAll({}, gd._fullLayout.tracecursors[j]);
        newTraceCursorsOut.push(cur);
    }

    if(newTraceCursorsOut.length) {
        newTraceCursorsOut.pop();
        update = {
            tracecursors: newTraceCursorsOut
        };
    }

    Registry.call('relayout', gd, update);
}
