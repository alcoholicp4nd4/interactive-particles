import EventEmitter from 'events';
import * as THREE from 'three';
import browser from 'browser-detect';

import { passiveEvent } from '../../utils/event.utils.js';

export default class InteractiveControls extends EventEmitter {

	get enabled() { return this._enabled; }

	constructor(camera, el) {
		super();

		this.camera = camera;
		this.el = el || window;

		this.plane = new THREE.Plane();
		this.raycaster = new THREE.Raycaster();

		this.mouse = new THREE.Vector2();
		this.offset = new THREE.Vector3();
		this.intersection = new THREE.Vector3();
		
		this.objects = [];
		this.hovered = null;
		this.selected = null;

		this.isDown = false;

		this.touchParticles = {};  // To store particles by touchId

		this.browser = browser();

		this.enable();
	}

	enable() {
		if (this.enabled) return;
		this.addListeners();
		this._enabled = true;
	}

	disable() {
		if (!this.enabled) return;
		this.removeListeners();
		this._enabled = false;
	}

	addListeners() {
		this.handlerDown = this.onDown.bind(this);
		this.handlerMove = this.onMove.bind(this);
		this.handlerUp = this.onUp.bind(this);
		this.handlerLeave = this.onLeave.bind(this);

		if (this.browser.mobile) {
			this.el.addEventListener('touchstart', this.handlerDown, passiveEvent);
			this.el.addEventListener('touchmove', this.handlerMove, passiveEvent);
			this.el.addEventListener('touchend', this.handlerUp, passiveEvent);
		}
		else {
			this.el.addEventListener('mousedown', this.handlerDown);
			this.el.addEventListener('mousemove', this.handlerMove);
			this.el.addEventListener('mouseup', this.handlerUp);
			this.el.addEventListener('mouseleave', this.handlerLeave);
		}
	}

	removeListeners() {
		if (this.browser.mobile) {
			this.el.removeEventListener('touchstart', this.handlerDown);
			this.el.removeEventListener('touchmove', this.handlerMove);
			this.el.removeEventListener('touchend', this.handlerUp);
		}
		else {
			this.el.removeEventListener('mousedown', this.handlerDown);
			this.el.removeEventListener('mousemove', this.handlerMove);
			this.el.removeEventListener('mouseup', this.handlerUp);
			this.el.removeEventListener('mouseleave', this.handlerLeave);
		}
	}

	resize(x, y, width, height) {
		if (x || y || width || height) {
			this.rect = { x, y, width, height };
		}
		else if (this.el === window) {
			this.rect = { x: 0, y: 0, width: window.innerWidth, height: window.innerHeight };
		}
		else {
			this.rect = this.el.getBoundingClientRect();
		}
	}

	// This function will now handle multiple touches
	onMove(e) {
		const touches = e.touches;

		// Loop through each touch and update the corresponding particle
		for (let i = 0; i < touches.length; i++) {
			const touch = touches[i];
			const touchId = touch.identifier;
			const touchPosition = new THREE.Vector3(touch.clientX, touch.clientY, 0);

			// Update the particle for the current touch
			this.updateParticle(touchId, touchPosition);
		}
		//handle intersections and hovering and raycasting 
		const intersects = this.raycaster.intersectObjects(this.objects);

		if (intersects.length > 0) {
			const object = intersects[0].object;
			this.intersectionData = intersects[0];

			this.plane.setFromNormalAndCoplanarPoint(this.camera.getWorldDirection(this.plane.normal), object.position);

			if (this.hovered !== object) {
				this.emit('interactive-out', { object: this.hovered });
				this.emit('interactive-over', { object });
				this.hovered = object;
			}
			else {
				this.emit('interactive-move', { object, intersectionData: this.intersectionData });
			}
		}
		else {
			this.intersectionData = null;

			if (this.hovered !== null) {
				this.emit('interactive-out', { object: this.hovered });
				this.hovered = null;
			}
		}
	}

	// This function will create particles on touchstart for each touch
	onDown(e) {
		this.isDown = true;
		this.onMove(e);

		// For each touch, create or update particles
		for (let i = 0; i < e.touches.length; i++) {
			const touch = e.touches[i];
			const touchId = touch.identifier;
			const touchPosition = new THREE.Vector3(touch.clientX, touch.clientY, 0);

			// Create particle or update it based on touchId
			this.createParticle(touchId, touchPosition);
		}

		this.emit('interactive-down', { object: this.hovered, previous: this.selected, intersectionData: this.intersectionData });
		this.selected = this.hovered;
	}

	// This function will remove the particles on touchend
	onUp(e) {
		this.isDown = false;

		// For each touch that ended, remove the particle
		for (let i = 0; i < e.changedTouches.length; i++) {
			const touch = e.changedTouches[i];
			const touchId = touch.identifier;

			this.removeParticle(touchId);
		}

		this.emit('interactive-up', { object: this.hovered });
	}

	// This function will remove the particles for a specific touchId
	removeParticle(touchId) {
		const particle = this.touchParticles[touchId];
		if (particle) {
			this.objects = this.objects.filter(obj => obj !== particle);  // Remove from objects
			this.touchParticles[touchId] = null;  // Remove from the touch particles map
		}
	}

	// Helper function to create a new particle based on touchId
	createParticle(touchId, position) {
		const geometry = new THREE.SphereGeometry(0.5, 32, 32);
		const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
		const particle = new THREE.Mesh(geometry, material);

		// Set particle position
		particle.position.set(position.x, position.y, position.z);
		this.objects.push(particle);

		// Store particle info by touchId
		this.touchParticles[touchId] = particle;
	}

	// Helper function to update an existing particle's position
	updateParticle(touchId, position) {
		const particle = this.touchParticles[touchId];
		if (particle) {
			particle.position.set(position.x, position.y, position.z);
		}
	}

	onLeave(e) {
		this.onUp(e);
		this.emit('interactive-out', { object: this.hovered });
		this.hovered = null;
	}
}
