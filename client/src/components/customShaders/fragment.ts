const fragmentShader = `
varying float vNoise;

void main(){
  //vec3 nightSky1 = vec3(0.,0.094,0.282);
  //vec3 nightSky2 = vec3(0.188,0.094,0.376);
  //vec3 nightSky3 = vec3(0.282,0.188,0.471);
  vec3 nightSky4 = vec3(0.376,0.282,0.471);
  vec3 nightSky5 = vec3(0.565,0.376,0.565);
  vec3 finalColor = mix(nightSky5,nightSky4,(vNoise + 1.0) * 0.5);
  gl_FragColor = vec4(finalColor,1.0);
}
`;
export default fragmentShader;
