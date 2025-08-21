import {
  Table,
  Column,
  Model,
  PrimaryKey,
  AutoIncrement,
  DataType,
  AllowNull,
  BelongsTo,
  ForeignKey, Default, HasMany
} from 'sequelize-typescript';
import {User} from "./User";

@Table({ tableName: 'pw_clans', timestamps: false })
export class PWClan extends Model<PWClan> {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare id: number;

  @AllowNull(false)
  @Column(DataType.STRING)
  declare name: string;

  @AllowNull(false)
  @Column(DataType.STRING)
  declare description: string;

  @AllowNull(false)
  @Column(DataType.STRING)
  declare tag: string;

  @AllowNull(false)
  @Default(0)
  @Column(DataType.INTEGER)
  declare xp: number;

  @AllowNull(false)
  @Default(0)
  @Column(DataType.INTEGER)
  declare level: number;

  @AllowNull(false)
  @Default(() => `#${Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0')}`) // Random hex
  @Column(DataType.STRING)
  declare color: string;

  @ForeignKey(() => User)
  @AllowNull(true)
  @Column(DataType.INTEGER)
  declare ownerId: number;

  @BelongsTo(() => User, 'ownerId')
  declare owner: User;

  @HasMany(() => User, 'pwClanId')
  declare members: User[];
}
