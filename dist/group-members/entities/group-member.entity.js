"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GroupMember = void 0;
const typeorm_1 = require("typeorm");
const group_entity_1 = require("../../groups/entities/group.entity");
const user_entity_1 = require("../../users/entities/user.entity");
let GroupMember = class GroupMember {
    group_id;
    user_id;
    group;
    user;
    role;
    joined_at;
};
exports.GroupMember = GroupMember;
__decorate([
    (0, typeorm_1.PrimaryColumn)('uuid'),
    __metadata("design:type", String)
], GroupMember.prototype, "group_id", void 0);
__decorate([
    (0, typeorm_1.PrimaryColumn)('uuid'),
    __metadata("design:type", String)
], GroupMember.prototype, "user_id", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => group_entity_1.Group, { nullable: false }),
    __metadata("design:type", group_entity_1.Group)
], GroupMember.prototype, "group", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_entity_1.User, { nullable: false }),
    __metadata("design:type", user_entity_1.User)
], GroupMember.prototype, "user", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 10 }),
    __metadata("design:type", String)
], GroupMember.prototype, "role", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp' }),
    __metadata("design:type", Date)
], GroupMember.prototype, "joined_at", void 0);
exports.GroupMember = GroupMember = __decorate([
    (0, typeorm_1.Entity)({ name: 'group_members' })
], GroupMember);
//# sourceMappingURL=group-member.entity.js.map