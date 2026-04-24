import { useWindowDimensions } from "react-native"

export const useLayoutInfo=()=>{
  const {width , height} = useWindowDimensions(); 
  const isTablet = width>=768; 
  const numofCols = isTablet? 3:2;
  const screenPadding = isTablet? 16:8;
  const cardGap = isTablet? 12:10;
  const deviceType = isTablet ? 'tablet' : 'mobile';
  
  return {
    width , 
    height ,   
    deviceType,
    numofCols,
    screenPadding,
    cardGap,
  }
}