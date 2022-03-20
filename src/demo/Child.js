/**
 * Created User: jett jindai.pjt@raycloud.com
 * Date Time: 2020/7/24 22:50
 * Description:
 */
import React from 'react';

export default (props = {}) => {
    console.log(`--- child-render ---`);
    return (
        <div>
            <p>number is : {props.number}</p>
        </div>
    );
};
