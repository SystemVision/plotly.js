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
    add: addSVCursor,
    delete: delSVCursor
};

/**
 * SVCursors wrapper around 'add' and 'delete'.
 *
 * @param {object} gd main plot object
 *
 */

function addSVCursor(gd) {
    // Get only "x" axes
    var axList = axisIds.list(gd, 'x', true);

    var rangeNow = [0, 1];

    var newSvcursorsOut = [];// Lib.extendDeepAll({}, gd._fullLayout.svcursors);


    for(var j = 0; j < gd._fullLayout.svcursors.length; j++) {
        var cur = Lib.extendDeepAll({}, gd._fullLayout.svcursors[j]);
        newSvcursorsOut.push(cur);
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

        var newSvcursorsIn = {
            x: xVal,
            xref: ax._id
        };

        newSvcursorsOut.push(newSvcursorsIn);
    }

    var update = {
        svcursors: newSvcursorsOut
    };

    Registry.call('relayout', gd, update);

}

function delSVCursor(gd) {
    var update = [];

    var newSvcursorsOut = [];


    for(var j = 0; j < gd._fullLayout.svcursors.length; j++) {
        var cur = Lib.extendDeepAll({}, gd._fullLayout.svcursors[j]);
        newSvcursorsOut.push(cur);
    }

    if(newSvcursorsOut.length) {
        newSvcursorsOut.pop();
        if(newSvcursorsOut.length) {
            update = {
                svcursors: newSvcursorsOut
            };
        }
    }

    Registry.call('relayout', gd, update);
}
