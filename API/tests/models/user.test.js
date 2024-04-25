// user.test.js

const { sequelize } = require('../../models');

describe('User model', () => {
  beforeAll(async () => {
    await sequelize.sync({ force: true });
  });

  it('should associate with Role', async () => {
    const role = await sequelize.models.role.create({
      type: "admin",
      description: "Administrator role",
      isAdmin: true
    });

    const user = await sequelize.models.user.create({
      name: 'Jpoezi',
      email: 'jp@gmail.com',
      encrypted_password: '123456',
      roleId: role.id,
      isActived: true
    });

    const associatedRole = await user.getRole();
    expect(associatedRole.type).toBe(role.type);
  });

  it('should associate with Person', async () => {
    const user = await sequelize.models.user.create({
      name: 'Jpoezi',
      email: 'jp@gmail.com',
      encrypted_password: '123456',
      roleId: 1,
      isActived: true
    });

    const person = await sequelize.models.person.create({
      fullName: 'Juan Pablo',
      personalEmail: 'jp@gmail.com',
      phoneNumber: '56998145715',
      location: 'Ohio',
      userId: user.id
    });

    const associatedUser = await person.getUser();
    expect(associatedUser.name).toBe('Jpoezi');
  })
});
