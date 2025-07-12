import { Table, Column, Model, PrimaryKey, AutoIncrement, DataType, AllowNull, Default } from 'sequelize-typescript';

@Table({ tableName: 'salaries', updatedAt: false })
export class Salary extends Model<Salary> {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare id: number;

  @AllowNull(false)
  @Column(DataType.JSONB)
  declare data: object;

  @AllowNull(false)
  @Default(DataType.NOW)
  @Column(DataType.DATE)
  declare completedAt: Date;
}
