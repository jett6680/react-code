/**
 * Created User: jett jindai.pjt@raycloud.com
 * Date Time: 2020/7/24 22:51
 * Description:
 */

// import React, { memo } from 'react';
//
// const isEqual = (prevProps, nextProps) => {
//     if (prevProps.number !== nextProps.number) {
//         return false;
//     }
//     return true;
// }
//
// export default memo((props = {}) => {
//     console.log(`--- memo re-render ---`);
//     return (
//         <div>
//             {/* <p>step is : {props.step}</p> */}
//             {/* <p>count is : {props.count}</p> */}
//             <p>number is : {props.number}</p>
//         </div>
//     );
// }, isEqual);
import React, {useMemo} from "react";


export default (props = {}) => {
    console.log(`--- component re-render ---`);
    return useMemo(() => {
        console.log(`--- useMemo re-render ---`);
        return <div>
            {/* <p>step is : {props.step}</p> */}
            {/* <p>count is : {props.count}</p> */}
            <p>number is : {props.number}</p>
        </div>
    }, [props.number]);
}
