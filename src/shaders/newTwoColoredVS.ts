import { Shader } from '@esotericsoftware/spine-webgl';

const vs = `
attribute vec4 ${Shader.POSITION};
attribute vec4 ${Shader.COLOR};
attribute vec4 ${Shader.COLOR2};
attribute vec2 ${Shader.TEXCOORDS};
uniform mat4 ${Shader.MVP_MATRIX};
varying vec4 v_light;
varying vec4 v_dark;
varying vec2 v_texCoords;

void main () {
	v_light = ${Shader.COLOR};
	v_dark = ${Shader.COLOR2};
	v_texCoords = ${Shader.TEXCOORDS};
	gl_Position = ${Shader.MVP_MATRIX} * ${Shader.POSITION};
}
`;

export default vs;